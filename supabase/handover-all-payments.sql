-- UPI payments are handed over (accounted for) the same way as cash.
-- Replaces create_handover so it no longer requires mode = 'cash'.
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
