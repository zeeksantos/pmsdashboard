-- Check-in / check-out as atomic, authorized RPCs rather than separate
-- client-side writes. SECURITY DEFINER so the checkout can insert into
-- housekeeping_tasks even for a front_desk caller (who has no direct
-- insert grant there) — authorization is enforced manually inside via
-- auth_role() instead of relying on RLS.

create or replace function check_in_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
  v_unit_status unit_status;
begin
  if auth_role() not in ('owner_admin', 'manager', 'front_desk') then
    raise exception 'Not authorized to check in bookings';
  end if;

  select unit_id into v_unit_id from bookings where id = p_booking_id;
  if v_unit_id is null then
    raise exception 'Booking not found';
  end if;

  select status into v_unit_status from units where id = v_unit_id;
  if v_unit_status is distinct from 'AVAILABLE' then
    raise exception 'Unit is % — mark it AVAILABLE before checking in', v_unit_status;
  end if;

  update bookings set status = 'CHECKED_IN' where id = p_booking_id;
  update units set status = 'OCCUPIED' where id = v_unit_id;
end;
$$;

grant execute on function check_in_booking(uuid) to authenticated;

create or replace function checkout_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
begin
  if auth_role() not in ('owner_admin', 'manager', 'front_desk') then
    raise exception 'Not authorized to check out bookings';
  end if;

  select unit_id into v_unit_id from bookings where id = p_booking_id;
  if v_unit_id is null then
    raise exception 'Booking not found';
  end if;

  update bookings set status = 'CHECKED_OUT' where id = p_booking_id;
  update units set status = 'DIRTY' where id = v_unit_id;

  insert into housekeeping_tasks (unit_id, booking_id, status, created_by)
  values (v_unit_id, p_booking_id, 'PENDING', auth.uid());
end;
$$;

grant execute on function checkout_booking(uuid) to authenticated;
