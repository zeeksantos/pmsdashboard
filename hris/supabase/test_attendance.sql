-- TEST ATTENDANCE for the payroll part of WALKTHROUGH.md. Run after test_data.sql. Safe to run again.
-- Period Jan 1 to Jan 15, 2026 has 11 working days (Mon-Fri).
--   Everyone: on time, every working day.
--   Eli (TEST-006): absent Jan 5 and Jan 6, and 20 minutes late on Jan 7.
insert into attendance_logs (employee_id, work_date, time_in, time_out, late_minutes, undertime_minutes)
select e.id, d::date,
       (d::date + time '09:00' + case when e.employee_no = 'TEST-006' and d::date = '2026-01-07'
                                      then interval '20 minutes' else interval '0' end) at time zone 'Asia/Manila',
       (d::date + time '18:00') at time zone 'Asia/Manila',
       case when e.employee_no = 'TEST-006' and d::date = '2026-01-07' then 20 else 0 end,
       0
  from employees e
 cross join generate_series('2026-01-01'::date, '2026-01-15'::date, interval '1 day') d
 where e.employee_no like 'TEST-00_'
   and extract(dow from d) between 1 and 5
   and not (e.employee_no = 'TEST-006' and d::date in ('2026-01-05', '2026-01-06'))
on conflict (employee_id, work_date) do nothing;

select e.employee_no, count(*) as days_logged, sum(a.late_minutes) as late_minutes
  from attendance_logs a join employees e on e.id = a.employee_id
 where a.work_date between '2026-01-01' and '2026-01-15' and e.employee_no like 'TEST-00_'
 group by e.employee_no order by e.employee_no;
