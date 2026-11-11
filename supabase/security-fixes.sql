-- Security and correctness fixes. Safe to re-run.

-- 1. Atomic failed-login counter (parallel guesses can no longer skip the lock).
create or replace function public.register_failed_login(
  p_profile uuid,
  p_max_attempts int,
  p_lock_minutes int
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set failed_attempts = case when failed_attempts + 1 >= p_max_attempts then 0 else failed_attempts + 1 end,
         locked_until = case when failed_attempts + 1 >= p_max_attempts
                             then now() + make_interval(mins => p_lock_minutes)
                             else locked_until end
   where id = p_profile;
$$;
revoke all on function public.register_failed_login(uuid, int, int) from public, anon, authenticated;
grant execute on function public.register_failed_login(uuid, int, int) to service_role;

-- 2. A handover for less than the chosen payments splits the last payment, so the
-- remainder stays with the coordinator and can be handed over later.
create or replace function public.create_handover(
  p_class uuid,
  p_payment_ids uuid[],
  p_actor uuid,
  p_actor_name text,
  p_amount numeric,
  p_confirm boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_total numeric;
  v_handover uuid;
  v_left numeric;
  v_take numeric;
  r record;
begin
  if p_payment_ids is null or cardinality(p_payment_ids) = 0 then
    raise exception 'Choose whose money is being handed over.' using errcode = 'P0001';
  end if;

  select array_agg(id), sum(amount) into v_ids, v_total
    from (
      select id, amount from public.payments
       where id = any (p_payment_ids)
         and class_id = p_class
         and handover_id is null
       for update
    ) eligible;

  if v_ids is null or cardinality(v_ids) <> cardinality(array(select distinct unnest(p_payment_ids))) then
    raise exception 'Some of those payments cannot be handed over. Refresh and try again.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount handed over.' using errcode = 'P0001';
  end if;
  if p_amount > v_total then
    raise exception 'The amount cannot be more than the % collected from these students.', v_total using errcode = 'P0001';
  end if;

  insert into public.handovers (class_id, amount, created_by, created_by_name, status, reviewed_by, reviewed_by_name, reviewed_at, review_note)
  values (
    p_class, p_amount, p_actor, p_actor_name,
    case when p_confirm then 'confirmed' else 'pending' end,
    case when p_confirm then p_actor end,
    case when p_confirm then p_actor_name end,
    case when p_confirm then now() end,
    case when p_confirm then 'Recorded by the admin on the coordinator''s behalf.' end
  )
  returning id into v_handover;

  v_left := p_amount;
  for r in select * from public.payments where id = any (v_ids) order by paid_at, id loop
    exit when v_left <= 0;
    v_take := least(r.amount, v_left);
    if v_take < r.amount then
      -- Keep the rest of this payment with the coordinator as its own row.
      insert into public.payments (student_id, class_id, amount, mode, notes, paid_at, created_by, created_by_name)
      values (r.student_id, r.class_id, r.amount - v_take, r.mode, r.notes, r.paid_at, r.created_by, r.created_by_name);
      update public.payments set amount = v_take, handover_id = v_handover where id = r.id;
    else
      update public.payments set handover_id = v_handover where id = r.id;
    end if;
    v_left := v_left - v_take;
  end loop;

  return v_handover;
end;
$$;
revoke all on function public.create_handover(uuid, uuid[], uuid, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.create_handover(uuid, uuid[], uuid, text, numeric, boolean) to service_role;

-- 3. The receipts bucket is unused: make it private and remove its policies.
drop policy if exists "receipts_read_policy" on storage.objects;
drop policy if exists "receipts_insert_policy" on storage.objects;
update storage.buckets set public = false where id = 'bill-receipts';
