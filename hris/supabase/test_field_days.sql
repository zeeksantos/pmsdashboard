-- TEST FIELD DAYS for the payroll part of WALKTHROUGH.md (10.2c). Run after test_attendance.sql. Safe to run again.
-- Marks two of Ella's days (Jan 8 and Jan 9, 2026) as Field / out of office.
update attendance_logs a
   set work_mode = 'FIELD', field_note = 'Test client shoot'
  from employees e
 where e.id = a.employee_id and e.employee_no = 'TEST-005'
   and a.work_date in ('2026-01-08', '2026-01-09');

select e.employee_no, a.work_date, a.work_mode, a.field_note
  from attendance_logs a join employees e on e.id = a.employee_id
 where e.employee_no = 'TEST-005' and a.work_mode = 'FIELD' order by a.work_date;
