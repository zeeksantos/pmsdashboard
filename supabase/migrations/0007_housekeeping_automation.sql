-- Starting/completing a housekeeping task also moves the unit through
-- DIRTY -> CLEANING -> AVAILABLE. Same atomic, authorized-RPC pattern as
-- check_in_booking / checkout_booking.

create or replace function start_housekeeping_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
begin
  if auth_role() not in ('owner_admin', 'manager', 'housekeeping') then
    raise exception 'Not authorized to update housekeeping tasks';
  end if;

  select unit_id into v_unit_id from housekeeping_tasks where id = p_task_id;
  if v_unit_id is null then
    raise exception 'Task not found';
  end if;

  update housekeeping_tasks set status = 'IN_PROGRESS' where id = p_task_id;
  update units set status = 'CLEANING' where id = v_unit_id;
end;
$$;

grant execute on function start_housekeeping_task(uuid) to authenticated;

create or replace function complete_housekeeping_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
begin
  if auth_role() not in ('owner_admin', 'manager', 'housekeeping') then
    raise exception 'Not authorized to update housekeeping tasks';
  end if;

  select unit_id into v_unit_id from housekeeping_tasks where id = p_task_id;
  if v_unit_id is null then
    raise exception 'Task not found';
  end if;

  update housekeeping_tasks set status = 'COMPLETED', completed_at = now() where id = p_task_id;
  update units set status = 'AVAILABLE' where id = v_unit_id;
end;
$$;

grant execute on function complete_housekeeping_task(uuid) to authenticated;
