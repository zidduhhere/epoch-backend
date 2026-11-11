-- Payments and cash handovers.
--
-- payments:   one row per payment a student makes (so collection can be charted by day
--             and a partly paid student can pay the rest later).
-- handovers:  a coordinator giving cash to the treasurer. It stays 'pending' until an
--             admin confirms receipt, or 'rejected' (its payments become available again).
--
-- students.amount_paid stays as the running total; record_payment() keeps it in step.
-- The old rep_handover_verified / treasurer_verified columns are no longer used.
-- All access is through the server (service role); direct access stays closed.

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  amount numeric not null check (amount > 0),
  mode public.payment_mode not null,
  notes text,
  paid_at timestamptz not null default now(),
  -- The calendar day in India, for day-by-day totals.
  paid_on date generated always as ((paid_at at time zone 'Asia/Kolkata')::date) stored,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text not null,
  handover_id uuid references public.handovers(id) on delete set null
);

create index if not exists idx_payments_class_day on public.payments(class_id, paid_on);
create index if not exists idx_payments_day on public.payments(paid_on);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_payments_handover on public.payments(handover_id);
create index if not exists idx_handovers_class on public.handovers(class_id, created_at desc);
create index if not exists idx_handovers_status on public.handovers(status);

alter table public.payments enable row level security;
alter table public.handovers enable row level security;

-- Records one payment and updates the student's running total in the same transaction.
-- Rejects a payment larger than what is still left to pay.
create or replace function public.record_payment(
  p_student uuid,
  p_amount numeric,
  p_mode public.payment_mode,
  p_notes text,
  p_actor uuid,
  p_actor_name text,
  p_actor_role text
) returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_left numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount above zero.' using errcode = 'P0001';
  end if;

  select * into v_student from public.students where id = p_student for update;
  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  v_left := v_student.amount_due - v_student.amount_paid;
  if p_amount > v_left then
    raise exception 'Only % is left to pay.', v_left using errcode = 'P0001';
  end if;

  insert into public.payments (student_id, class_id, amount, mode, notes, created_by, created_by_name)
  values (v_student.id, v_student.class_id, p_amount, p_mode, nullif(trim(p_notes), ''), p_actor, p_actor_name);

  update public.students
     set amount_paid = amount_paid + p_amount,
         payment_mode = p_mode,
         notes = coalesce(nullif(trim(p_notes), ''), notes),
         updated_by = p_actor,
         updated_by_name = p_actor_name,
         updated_by_role = p_actor_role,
         updated_at = now()
   where id = v_student.id;

  return v_student.amount_paid + p_amount;
end;
$$;

-- A coordinator hands the cash from the chosen payments to the treasurer.
-- Only cash payments of that class that are not already in a handover can be included.
create or replace function public.create_handover(
  p_class uuid,
  p_payment_ids uuid[],
  p_actor uuid,
  p_actor_name text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_total numeric;
  v_handover uuid;
begin
  if p_payment_ids is null or cardinality(p_payment_ids) = 0 then
    raise exception 'Choose at least one payment to hand over.' using errcode = 'P0001';
  end if;

  select array_agg(id), sum(amount) into v_ids, v_total
    from (
      select id, amount from public.payments
       where id = any (p_payment_ids)
         and class_id = p_class
         and mode = 'cash'
         and handover_id is null
       for update
    ) eligible;

  if v_ids is null or cardinality(v_ids) <> cardinality(array(select distinct unnest(p_payment_ids))) then
    raise exception 'Some of those payments cannot be handed over. Refresh and try again.' using errcode = 'P0001';
  end if;

  insert into public.handovers (class_id, amount, created_by, created_by_name)
  values (p_class, v_total, p_actor, p_actor_name)
  returning id into v_handover;

  update public.payments set handover_id = v_handover where id = any (v_ids);
  return v_handover;
end;
$$;

-- An admin confirms the cash arrived, or rejects the handover. A rejected handover
-- frees its payments so the coordinator can hand them over again.
create or replace function public.review_handover(
  p_handover uuid,
  p_confirm boolean,
  p_actor uuid,
  p_actor_name text,
  p_note text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.handovers where id = p_handover for update;
  if not found then
    raise exception 'Handover not found.' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'This handover was already reviewed.' using errcode = 'P0001';
  end if;

  update public.handovers
     set status = case when p_confirm then 'confirmed' else 'rejected' end,
         reviewed_by = p_actor,
         reviewed_by_name = p_actor_name,
         reviewed_at = now(),
         review_note = nullif(trim(p_note), '')
   where id = p_handover;

  if not p_confirm then
    update public.payments set handover_id = null where handover_id = p_handover;
  end if;
end;
$$;

revoke all on function public.record_payment(uuid, numeric, public.payment_mode, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_handover(uuid, uuid[], uuid, text) from public, anon, authenticated;
revoke all on function public.review_handover(uuid, boolean, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_mode, text, uuid, text, text) to service_role;
grant execute on function public.create_handover(uuid, uuid[], uuid, text) to service_role;
grant execute on function public.review_handover(uuid, boolean, uuid, text, text) to service_role;

revoke all on public.payments, public.handovers from anon, authenticated;
grant all on public.payments, public.handovers to service_role;
