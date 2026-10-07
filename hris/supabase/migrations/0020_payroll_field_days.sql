-- Field / out-of-office days per employee for a pay period (days timed in as FIELD, 0016).
-- Separate from payroll_inputs_v2 so that function's return type stays as it is.
-- Payroll managers only, like payroll_inputs_v2.
create or replace function payroll_field_days(p_start date, p_end date)
returns table (employee_id uuid, field_days numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('finance', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_end < p_start or p_end - p_start > 62 then raise exception 'Invalid pay period'; end if;
  return query
    select a.employee_id, count(*)::numeric
      from attendance_logs a
     where a.work_date between p_start and p_end
       and a.work_mode = 'FIELD'
       and a.time_in is not null
     group by a.employee_id;
end $$;

revoke execute on function payroll_field_days(date, date) from public, anon;
grant execute on function payroll_field_days(date, date) to authenticated;
