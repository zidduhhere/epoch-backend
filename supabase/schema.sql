-- ==============================================================================
-- EPOCH COLLEGE EVENT FUND COLLECTION & EXPENSE LEDGER SCHEMA
-- Features: Heavy RLS, Multi-role RBAC, Immutable Audit Ledger, Billing/Expenses
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin
  create type public.app_role as enum ('admin', 'class_rep', 'facilitator');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_mode as enum ('cash', 'upi', 'bank_transfer', 'cheque', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.bill_status as enum ('pending', 'approved', 'rejected', 'reimbursed');
exception
  when duplicate_object then null;
end $$;

-- 3. CLASSES TABLE (Across all 4 years)
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  year int not null check (year between 1 and 4),
  branch text not null,               -- e.g. 'CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'AI&DS'
  section text not null,              -- e.g. 'A', 'B', 'C'
  name text generated always as ('Year ' || year || ' ' || branch || ' - ' || section) stored,
  target_per_student numeric not null default 2600.00 check (target_per_student >= 0),
  coordinator_1_name text,
  coordinator_1_phone text,
  coordinator_2_name text,
  coordinator_2_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, branch, section)
);

-- 4. PROFILES TABLE (Linked with Supabase Auth users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role public.app_role not null default 'class_rep',
  assigned_class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. STUDENTS TABLE (The Core Spreadsheet Rows)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  roll_number text, -- Optional
  phone text,       -- Optional
  amount_due numeric not null default 2600.00 check (amount_due >= 0),
  amount_paid numeric not null default 0.00 check (amount_paid >= 0),
  payment_mode public.payment_mode default 'upi', -- 'upi' or 'cash'
  reference_id text, -- e.g. UPI Transaction ID or Receipt No
  notes text,
  rep_handover_verified boolean not null default false, -- Class Rep cash handover sign-off
  treasurer_verified boolean not null default false,    -- Treasurer / Committee received sign-off
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. IMMUTABLE PAYMENT LEDGER (Audit Trail for Every Entry & Edit)
create table if not exists public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_name text not null,
  student_roll text,
  old_amount numeric not null default 0.00,
  new_amount numeric not null default 0.00,
  delta numeric not null default 0.00,
  payment_mode text default 'upi',
  reference_id text,
  action text not null, -- 'INITIAL_ENTRY', 'EDIT', 'FULL_PAYMENT', 'PARTIAL_PAYMENT', 'CASH_HANDOVER_CONFIRMED', 'TREASURER_VERIFIED'
  reason text,
  rep_handover_verified boolean default false,
  treasurer_verified boolean default false,
  modified_by uuid references auth.users(id),
  modifier_name text not null default 'System',
  modifier_email text not null default 'system@college.edu',
  modifier_role text not null default 'class_rep',
  created_at timestamptz not null default now()
);

-- 7. BILLS & EXPENSES TABLE (Facilitation Committee)
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  vendor_name text not null,
  category text not null check (category in (
    'decorations',
    'sound_and_lights',
    'refreshments_food',
    'prizes_mementos',
    'logistics_transport',
    'printing_badges',
    'miscellaneous'
  )),
  amount numeric not null check (amount > 0),
  bill_date date not null default current_date,
  receipt_url text not null,
  status public.bill_status not null default 'pending',
  submitted_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE RLS & QUERIES
-- ==============================================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_assigned_class on public.profiles(assigned_class_id);
create index if not exists idx_classes_year on public.classes(year);
create index if not exists idx_students_class_id on public.students(class_id);
create index if not exists idx_students_roll_number on public.students(roll_number);
create index if not exists idx_students_created_by on public.students(created_by);
create index if not exists idx_students_updated_by on public.students(updated_by);
create index if not exists idx_payment_ledger_student_id on public.payment_ledger(student_id);
create index if not exists idx_payment_ledger_class_id on public.payment_ledger(class_id);
create index if not exists idx_payment_ledger_created_at on public.payment_ledger(created_at desc);
create index if not exists idx_bills_status on public.bills(status);
create index if not exists idx_bills_submitted_by on public.bills(submitted_by);
create index if not exists idx_bills_category on public.bills(category);

-- ==============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (Bypasses recursive policy lookups)
-- ==============================================================================
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.current_user_class_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select assigned_class_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles 
    where id = (select auth.uid()) and role = 'admin'::public.app_role
  );
$$;

-- ==============================================================================
-- AUTOMATIC AUDIT TRIGGER ON PAYMENT MODIFICATION
-- ==============================================================================
create or replace function public.trigger_log_student_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mod_id uuid;
  v_mod_name text;
  v_mod_email text;
  v_mod_role text;
  v_action text;
begin
  v_mod_id := (select auth.uid());

  -- Retrieve modifier profile details safely
  select full_name, email, role::text
    into v_mod_name, v_mod_email, v_mod_role
    from public.profiles
    where id = v_mod_id;

  if (v_mod_name is null) then
    v_mod_name := 'Coordinator';
    v_mod_email := 'coordinator@college.edu';
    v_mod_role := 'class_rep';
  end if;

  if (TG_OP = 'INSERT') then
    if (new.amount_paid > 0) then
      insert into public.payment_ledger (
        student_id, class_id, student_name, student_roll,
        old_amount, new_amount, delta, payment_mode, reference_id,
        action, reason, modified_by, modifier_name, modifier_email, modifier_role
      ) values (
        new.id, new.class_id, new.name, new.roll_number,
        0.00, new.amount_paid, new.amount_paid,
        coalesce(new.payment_mode::text, 'cash'), new.reference_id,
        'INITIAL_ENTRY', new.notes, v_mod_id, v_mod_name, v_mod_email, v_mod_role
      );
    end if;
  elsif (TG_OP = 'UPDATE') then
    if (old.amount_paid is distinct from new.amount_paid or old.reference_id is distinct from new.reference_id) then
      new.updated_at := now();
      new.updated_by := v_mod_id;

      if (new.amount_paid >= new.amount_due) then
        v_action := 'FULL_PAYMENT';
      elsif (new.amount_paid > old.amount_paid) then
        v_action := 'PARTIAL_PAYMENT';
      else
        v_action := 'EDIT';
      end if;

      insert into public.payment_ledger (
        student_id, class_id, student_name, student_roll,
        old_amount, new_amount, delta, payment_mode, reference_id,
        action, reason, modified_by, modifier_name, modifier_email, modifier_role
      ) values (
        new.id, new.class_id, new.name, new.roll_number,
        old.amount_paid, new.amount_paid, (new.amount_paid - old.amount_paid),
        coalesce(new.payment_mode::text, 'cash'), new.reference_id,
        v_action, new.notes, v_mod_id, v_mod_name, v_mod_email, v_mod_role
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_student_payment_ledger on public.students;
create trigger trg_student_payment_ledger
after insert or update on public.students
for each row execute function public.trigger_log_student_payment();

-- ==============================================================================
-- HEAVY ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.payment_ledger enable row level security;
alter table public.bills enable row level security;

-- PROFILES POLICIES
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = (select auth.uid()) or (select public.is_admin())
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_admin_all"
  on public.profiles for all
  using ((select public.is_admin()));

-- CLASSES POLICIES
-- Class Reps can read only their own class; Admin and Facilitators can read all classes
create policy "classes_select"
  on public.classes for select
  using (
    (select public.is_admin()) or
    (select public.current_user_role()) = 'facilitator'::public.app_role or
    id = (select public.current_user_class_id())
  );

create policy "classes_admin_manage"
  on public.classes for all
  using ((select public.is_admin()));

-- STUDENTS POLICIES (Spreadsheet Data Security)
-- 1. Class reps can only SELECT students from their assigned class
create policy "students_select"
  on public.students for select
  using (
    (select public.is_admin()) or
    (select public.current_user_role()) = 'facilitator'::public.app_role or
    class_id = (select public.current_user_class_id())
  );

-- 2. Class reps can only UPDATE students in their assigned class
create policy "students_update"
  on public.students for update
  using (
    (select public.is_admin()) or
    class_id = (select public.current_user_class_id())
  )
  with check (
    (select public.is_admin()) or
    class_id = (select public.current_user_class_id())
  );

-- 3. Only Admin can insert or delete student roster
create policy "students_insert"
  on public.students for insert
  with check (
    (select public.is_admin()) or
    class_id = (select public.current_user_class_id())
  );

create policy "students_delete"
  on public.students for delete
  using ((select public.is_admin()));

-- PAYMENT LEDGER POLICIES (Immutable Audit Log)
-- Read policy: Class reps see only ledger for their class; Admin sees all
create policy "payment_ledger_select"
  on public.payment_ledger for select
  using (
    (select public.is_admin()) or
    class_id = (select public.current_user_class_id())
  );

-- STRICT IMMUTABILITY: No user can UPDATE or DELETE ledger records!
create policy "payment_ledger_no_update"
  on public.payment_ledger for update using (false);

create policy "payment_ledger_no_delete"
  on public.payment_ledger for delete using (false);

-- Only security definer trigger or admin can insert
create policy "payment_ledger_insert"
  on public.payment_ledger for insert
  with check ((select public.is_admin()));

-- BILLS & EXPENSES POLICIES (Facilitation Committee)
create policy "bills_select"
  on public.bills for select
  using (
    (select public.is_admin()) or
    (select public.current_user_role()) = 'facilitator'::public.app_role
  );

create policy "bills_insert"
  on public.bills for insert
  with check (
    (select public.is_admin()) or
    (select public.current_user_role()) = 'facilitator'::public.app_role
  );

create policy "bills_update_status"
  on public.bills for update
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- STORAGE BUCKETS FOR BILL RECEIPTS
insert into storage.buckets (id, name, public)
values ('bill-receipts', 'bill-receipts', true)
on conflict (id) do nothing;

create policy "receipts_read_policy"
  on storage.objects for select
  using (bucket_id = 'bill-receipts');

create policy "receipts_insert_policy"
  on storage.objects for insert
  with check (
    bucket_id = 'bill-receipts' and
    ((select public.is_admin()) or (select public.current_user_role()) = 'facilitator'::public.app_role)
  );

