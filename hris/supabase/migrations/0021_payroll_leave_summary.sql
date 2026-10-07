-- Leave days per employee and leave type for a pay period, for the leave pay summary report.
-- Same day-by-day rules as payroll_inputs: a day counts only if it is a scheduled working day,
-- the employee didn't time in, and an approved leave covers it (paid leave preferred when two
-- overlap). A half-day paid leave is 0.5; unpaid leave counts as a whole absent day, as payroll does.
-- Payroll managers only (finance can't read the leave tables directly).
create or replace function payroll_leave_summary(p_start date, p_end date)
returns table (employee_id uuid, leave_type text, is_paid boolean, days numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('finance', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_end < p_start or p_end - p_start > 62 then raise exception 'Invalid pay period'; end if;
  return query
    select x.emp, x.tname, x.paid, sum(x.val)::numeric
      from (
        select distinct on (e.id, g.d)
               e.id as emp, t.name as tname, t.is_paid as paid,
               case when t.is_paid and l.half_day then 0.5 else 1 end as val
          from employees e
          cross join lateral (select gs::date as d from generate_series(p_start, p_end, interval '1 day') gs) g
          join leave_requests l on l.employee_id = e.id and l.status = 'APPROVED'
                               and g.d between l.start_date and l.end_date
          join leave_types t on t.id = l.leave_type_id
         where e.status = 'ACTIVE' and e.date_hired <= p_end and g.d >= e.date_hired
           and is_working_day(e.id, g.d)
           and not exists (select 1 from attendance_logs a
                            where a.employee_id = e.id and a.work_date = g.d and a.time_in is not null)
         order by e.id, g.d, t.is_paid desc
      ) x
     group by x.emp, x.tname, x.paid;
end $$;

revoke execute on function payroll_leave_summary(date, date) from public, anon;
grant execute on function payroll_leave_summary(date, date) to authenticated;
