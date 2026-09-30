-- TEST DATA for the walkthrough (WALKTHROUGH.md). Not a migration: run it once, by hand.
-- Before running: create these six logins in Supabase (Authentication -> Users -> Add user,
-- tick "Auto Confirm User"), then replace YOU with your own email name in the six emails below
-- (yourname+owner@gmail.com and so on all arrive in your one inbox). Safe to run again.

do $$
declare
  r record;
  missing text;
  uid uuid;
  emp uuid;
begin

  for r in
    select * from (values
      ('YOU+owner@gmail.com',   'TEST-001', 'Olivia Owner',  'owner',    'Admin',     null,       60000),
      ('YOU+hr@gmail.com',      'TEST-002', 'Hannah HR',     'hr',       'HR',        'TEST-001', 30000),
      ('YOU+finance@gmail.com', 'TEST-003', 'Felix Finance', 'finance',  'Finance',   'TEST-001', 30000),
      ('YOU+manager@gmail.com', 'TEST-004', 'Marco Manager', 'manager',  'Marketing', 'TEST-001', 40000),
      ('YOU+emp1@gmail.com',    'TEST-005', 'Ella Employee', 'employee', 'Marketing', 'TEST-004', 20000),
      ('YOU+emp2@gmail.com',    'TEST-006', 'Eli Employee',  'employee', 'Marketing', 'TEST-004', 18000)
    ) as t(email, employee_no, full_name, role, dept, boss_no, monthly_rate)
  loop
    -- The login must already exist in Authentication -> Users.
    select id into uid from auth.users where lower(email) = lower(r.email);
    if uid is null then
      missing := coalesce(missing || ', ', '') || r.email;
      continue;
    end if;

    insert into user_roles (user_id, role) values (uid, r.role::hris_role)
      on conflict (user_id) do update set role = excluded.role;

    insert into employees (user_id, employee_no, full_name, work_email, department_id, employment_type, date_hired)
      values (uid, r.employee_no, r.full_name, r.email,
              (select id from departments where name = r.dept), 'REGULAR', '2026-01-01')
      on conflict (employee_no) do nothing;
    select id into emp from employees where employee_no = r.employee_no;

    if r.boss_no is not null then
      update employees set reports_to = (select id from employees where employee_no = r.boss_no)
       where id = emp;
    end if;

    -- 9:00 to 18:00, Monday to Friday.
    insert into work_schedules (employee_id, days_of_week, start_time, end_time, effective_from)
      select emp, '{1,2,3,4,5}', '09:00', '18:00', '2026-01-01'
       where not exists (select 1 from work_schedules where employee_id = emp);

    insert into employee_salaries (employee_id, monthly_rate, effective_from)
      select emp, r.monthly_rate, '2026-01-01'
       where not exists (select 1 from employee_salaries where employee_id = emp);
  end loop;

  if missing is not null then
    raise exception 'These logins do not exist yet in Authentication -> Users (nothing was saved): %', missing;
  end if;
end $$;

-- What was created:
select e.employee_no, e.full_name, r.role, b.full_name as reports_to
  from employees e
  left join user_roles r on r.user_id = e.user_id
  left join employees b on b.id = e.reports_to
 where e.employee_no like 'TEST-%'
 order by e.employee_no;
