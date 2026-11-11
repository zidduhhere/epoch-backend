-- Handovers now carry a typed amount, and an admin can record one on a coordinator's
-- behalf (created already confirmed).
-- The typed amount may be less than the chosen payments add up to (a part handover),
-- never more.
drop function if exists public.create_handover(uuid, uuid[], uuid, text);

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

  update public.payments set handover_id = v_handover where id = any (v_ids);
  return v_handover;
end;
$$;

revoke all on function public.create_handover(uuid, uuid[], uuid, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.create_handover(uuid, uuid[], uuid, text, numeric, boolean) to service_role;
