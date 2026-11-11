-- ==============================================================================
-- PHONE LOGIN MIGRATION
-- Run once in the Supabase SQL editor, after schema.sql and patch.sql.
--
-- What this does:
--   1. Closes all direct database access. The browser's public key stops working
--      for every table. Only the app's server (service role key) can read or write.
--   2. Changes profiles so logins are a phone number and a hashed password,
--      stored in profiles and independent of Supabase Auth.
--   3. Adds server-side sessions and makes the audit log record the signed-in user.
--   4. DELETES ALL EXISTING DATA (classes, students, audit entries, expenses,
--      profiles and old Supabase Auth accounts), which is all demo data, then
--      creates the 31 real classes. This cannot be undone.
--
-- The whole script runs in one transaction: if any step fails, nothing changes.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. CLOSE DIRECT ACCESS
-- RLS stays on with no policies, which denies anon and authenticated by default.
-- The service role bypasses RLS and is used only on the server.
-- ------------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'classes', 'students', 'payment_ledger', 'bills')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on routines from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. PROFILES BECOME THE LOGIN TABLE
-- Existing rows without a password_hash simply cannot sign in.
-- ------------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles alter column email drop not null;

alter table public.profiles add column if not exists password_hash text;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists failed_attempts int not null default 0;
alter table public.profiles add column if not exists locked_until timestamptz;
alter table public.profiles add column if not exists title text; -- an admin's position, e.g. Treasurer

alter table public.profiles
  add constraint profiles_phone_format
  check (phone is null or phone ~ '^[6-9][0-9]{9}$') not valid;

create unique index if not exists idx_profiles_phone_unique
  on public.profiles (phone) where phone is not null;

-- Actors are now profiles, not Supabase Auth users.
alter table public.students drop constraint if exists students_created_by_fkey;
alter table public.students drop constraint if exists students_updated_by_fkey;
alter table public.payment_ledger drop constraint if exists payment_ledger_modified_by_fkey;
alter table public.bills drop constraint if exists bills_submitted_by_fkey;
alter table public.bills drop constraint if exists bills_approved_by_fkey;

alter table public.students
  add constraint students_created_by_fkey foreign key (created_by)
  references public.profiles(id) on delete set null not valid;
alter table public.students
  add constraint students_updated_by_fkey foreign key (updated_by)
  references public.profiles(id) on delete set null not valid;
alter table public.payment_ledger
  add constraint payment_ledger_modified_by_fkey foreign key (modified_by)
  references public.profiles(id) on delete set null not valid;
alter table public.bills
  add constraint bills_submitted_by_fkey foreign key (submitted_by)
  references public.profiles(id) on delete set null not valid;
alter table public.bills
  add constraint bills_approved_by_fkey foreign key (approved_by)
  references public.profiles(id) on delete set null not valid;

alter table public.bills alter column submitted_by drop not null;
alter table public.bills add column if not exists submitted_by_name text;
alter table public.bills add column if not exists approved_by_name text;
alter table public.students add column if not exists updated_by_name text;
alter table public.students add column if not exists updated_by_role text;

-- ------------------------------------------------------------------------------
-- 3. SERVER-SIDE SESSIONS
-- Only a SHA-256 hash of the cookie token is stored.
-- ------------------------------------------------------------------------------
create table if not exists public.app_sessions (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_sessions_profile on public.app_sessions(profile_id);
alter table public.app_sessions enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ------------------------------------------------------------------------------
-- 4. AUDIT TRIGGER USES THE ACTOR THE SERVER WROTE ON THE ROW
-- auth.uid() is always null now. The trigger is the only writer of ledger rows.
-- modifier_email is kept as the column name and now stores the actor's phone.
-- modifier_role stores an admin's position, or the role when there is no position.
-- ------------------------------------------------------------------------------
create or replace function public.trigger_log_student_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_phone text;
  v_role text;
  v_action text;
begin
  v_id := case when TG_OP = 'INSERT' then new.created_by else new.updated_by end;

  if v_id is not null then
    select full_name, phone, coalesce(title, role::text)
      into v_name, v_phone, v_role
      from public.profiles
      where id = v_id;
  end if;

  v_name := coalesce(v_name, 'System');
  v_phone := coalesce(v_phone, 'system');
  v_role := coalesce(v_role, 'admin');

  if TG_OP = 'INSERT' then
    if new.amount_paid > 0 then
      insert into public.payment_ledger (
        student_id, class_id, student_name, student_roll,
        old_amount, new_amount, delta, payment_mode, reference_id,
        action, reason, rep_handover_verified, treasurer_verified,
        modified_by, modifier_name, modifier_email, modifier_role
      ) values (
        new.id, new.class_id, new.name, new.roll_number,
        0, new.amount_paid, new.amount_paid,
        coalesce(new.payment_mode::text, 'cash'), new.reference_id,
        'INITIAL_ENTRY', new.notes, new.rep_handover_verified, new.treasurer_verified,
        v_id, v_name, v_phone, v_role
      );
    end if;
    return new;
  end if;

  if old.amount_paid is distinct from new.amount_paid then
    if new.amount_paid >= new.amount_due then
      v_action := 'FULL_PAYMENT';
    elsif new.amount_paid = 0 then
      v_action := 'CORRECTION';
    elsif new.amount_paid > old.amount_paid then
      v_action := 'PARTIAL_PAYMENT';
    else
      v_action := 'EDIT';
    end if;

    insert into public.payment_ledger (
      student_id, class_id, student_name, student_roll,
      old_amount, new_amount, delta, payment_mode, reference_id,
      action, reason, rep_handover_verified, treasurer_verified,
      modified_by, modifier_name, modifier_email, modifier_role
    ) values (
      new.id, new.class_id, new.name, new.roll_number,
      old.amount_paid, new.amount_paid, new.amount_paid - old.amount_paid,
      coalesce(new.payment_mode::text, 'cash'), new.reference_id,
      v_action, new.notes, new.rep_handover_verified, new.treasurer_verified,
      v_id, v_name, v_phone, v_role
    );
  end if;

  if old.rep_handover_verified is distinct from new.rep_handover_verified then
    insert into public.payment_ledger (
      student_id, class_id, student_name, student_roll,
      old_amount, new_amount, delta, payment_mode,
      action, reason, rep_handover_verified, treasurer_verified,
      modified_by, modifier_name, modifier_email, modifier_role
    ) values (
      new.id, new.class_id, new.name, new.roll_number,
      new.amount_paid, new.amount_paid, 0, 'cash',
      'CASH_HANDOVER_CONFIRMED',
      case when new.rep_handover_verified then 'Cash handed to the treasurer' else 'Handover cleared' end,
      new.rep_handover_verified, new.treasurer_verified,
      v_id, v_name, v_phone, v_role
    );
  end if;

  if old.treasurer_verified is distinct from new.treasurer_verified then
    insert into public.payment_ledger (
      student_id, class_id, student_name, student_roll,
      old_amount, new_amount, delta, payment_mode,
      action, reason, rep_handover_verified, treasurer_verified,
      modified_by, modifier_name, modifier_email, modifier_role
    ) values (
      new.id, new.class_id, new.name, new.roll_number,
      new.amount_paid, new.amount_paid, 0, 'cash',
      'TREASURER_VERIFIED',
      case when new.treasurer_verified then 'Cash received in the vault' else 'Receipt cleared' end,
      new.rep_handover_verified, new.treasurer_verified,
      v_id, v_name, v_phone, v_role
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. REMOVE ALL DEMO DATA AND CREATE THE REAL CLASSES
-- MECHT runs for three years. Every other department runs for four.
-- ------------------------------------------------------------------------------
do $$
begin
  if coalesce(current_setting('app.confirm_wipe', true), '') <> 'yes' then
    raise exception 'This deletes ALL classes, students, bills and logins. Run: set app.confirm_wipe = ''yes''; first, only on a database with no real data.';
  end if;
end $$;

delete from public.payment_ledger;
delete from public.students;
delete from public.bills;
delete from public.classes;
delete from public.app_sessions;
delete from public.profiles;
delete from auth.users;

insert into public.classes (year, branch, section, target_per_student)
select y, d, 'A', 2600.00
from unnest(array['CSE', 'AIML', 'EEE', 'ECE', 'AERO', 'MECH', 'MECHT', 'CIVIL']) as d,
     generate_series(1, 4) as y
where not (d = 'MECHT' and y = 4);

commit;
