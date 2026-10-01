-- Helpers -------------------------------------------------------------------
create or replace function current_hris_role() returns hris_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from user_roles where user_id = auth.uid()), 'employee'::hris_role);
$$;

create or replace function current_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where user_id = auth.uid();
$$;

create or replace function has_role(variadic roles hris_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select current_hris_role() = any(roles);
$$;

-- Audit ---------------------------------------------------------------------
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into audit_logs (user_id, role, action, resource, resource_id, details)
  values (auth.uid(), current_hris_role(), tg_op::audit_action, tg_table_name,
          rec ->> 'id',
          case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
               else rec end);
  return coalesce(new, old);
end $$;

create or replace function audit_immutable() returns trigger
language plpgsql as $$ begin raise exception 'audit_logs is append-only'; end $$;
create trigger audit_logs_no_change before update or delete on audit_logs
  for each row execute function audit_immutable();

do $$ declare t text; begin
  foreach t in array array['employees','employee_biodata','employee_documents',
    'employee_salaries','work_schedules','attendance_logs','user_roles','positions','departments']
  loop
    execute format('create trigger %I after insert or update or delete on %I
                    for each row execute function audit_row()', 'audit_' || t, t);
  end loop;
end $$;

-- Time in / out (Asia/Manila, 15-min grace before and after shift) ----------
-- late_minutes: 0 if clock-in is within 15 min after shift start, else minutes past start.
-- undertime_minutes: 0 if clock-out is within 15 min before shift end, else minutes short.
create or replace function clock_in(p_lat double precision, p_lng double precision, p_accuracy real)
returns attendance_logs language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  now_mnl timestamp := now() at time zone 'Asia/Manila';
  today date := (now() at time zone 'Asia/Manila')::date;
  sched work_schedules;
  late int := 0;
  row attendance_logs;
begin
  if emp is null then raise exception 'No employee profile for this user'; end if;
  select * into sched from work_schedules
   where employee_id = emp and extract(dow from today)::int = any(days_of_week)
     and effective_from <= today and (effective_to is null or effective_to >= today)
   order by effective_from desc limit 1;
  if found then
    late := greatest(0, floor(extract(epoch from (now_mnl - (today + sched.start_time))) / 60)::int);
    if late <= 15 then late := 0; end if;
  end if;
  insert into attendance_logs (employee_id, work_date, time_in, in_lat, in_lng, in_accuracy_m, late_minutes)
  values (emp, today, now(), p_lat, p_lng, p_accuracy, late)
  returning * into row;
  return row;
exception when unique_violation then
  raise exception 'Already timed in today';
end $$;

create or replace function clock_out(p_lat double precision, p_lng double precision, p_accuracy real)
returns attendance_logs language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  now_mnl timestamp := now() at time zone 'Asia/Manila';
  today date := (now() at time zone 'Asia/Manila')::date;
  sched work_schedules;
  under int := 0;
  row attendance_logs;
begin
  if emp is null then raise exception 'No employee profile for this user'; end if;
  select * into sched from work_schedules
   where employee_id = emp and extract(dow from today)::int = any(days_of_week)
     and effective_from <= today and (effective_to is null or effective_to >= today)
   order by effective_from desc limit 1;
  if found then
    under := greatest(0, floor(extract(epoch from ((today + sched.end_time) - now_mnl)) / 60)::int);
    if under <= 15 then under := 0; end if;
  end if;
  update attendance_logs
     set time_out = now(), out_lat = p_lat, out_lng = p_lng, out_accuracy_m = p_accuracy,
         undertime_minutes = under
   where employee_id = emp and work_date = today and time_in is not null and time_out is null
   returning * into row;
  if row.id is null then raise exception 'No open time-in for today'; end if;
  return row;
end $$;

-- RLS -----------------------------------------------------------------------
alter table departments        enable row level security;
alter table positions          enable row level security;
alter table employees          enable row level security;
alter table user_roles         enable row level security;
alter table employee_biodata   enable row level security;
alter table employee_documents enable row level security;
alter table employee_salaries  enable row level security;
alter table work_schedules     enable row level security;
alter table attendance_logs    enable row level security;
alter table audit_logs         enable row level security;

-- Org structure: readable by any signed-in user; edited by HR/admin/owner.
create policy dept_read on departments for select using (auth.uid() is not null);
create policy dept_write on departments for all using (has_role('hr','admin','owner')) with check (has_role('hr','admin','owner'));
create policy pos_read on positions for select using (auth.uid() is not null);
create policy pos_write on positions for all using (has_role('hr','admin','owner')) with check (has_role('hr','admin','owner'));

-- Employees (work info): self, or manager/hr/admin/owner. Finance can read names for payroll lookups.
create policy emp_read on employees for select using (
  user_id = auth.uid() or has_role('manager','hr','finance','admin','owner'));
create policy emp_write on employees for all using (has_role('hr','admin','owner'))
  with check (has_role('hr','admin','owner'));

-- Roles: admin/owner only.
create policy roles_self_read on user_roles for select using (user_id = auth.uid() or has_role('admin','owner'));
create policy roles_write on user_roles for all using (has_role('admin','owner')) with check (has_role('admin','owner'));

-- Sensitive records: HR/admin/owner; employee sees own biodata/documents. Managers and finance do NOT.
create policy bio_read on employee_biodata for select using (
  employee_id = current_employee_id() or has_role('hr','admin','owner'));
create policy bio_write on employee_biodata for all using (has_role('hr','admin','owner'))
  with check (has_role('hr','admin','owner'));
create policy docs_read on employee_documents for select using (
  employee_id = current_employee_id() or has_role('hr','admin','owner'));
create policy docs_write on employee_documents for all using (has_role('hr','admin','owner'))
  with check (has_role('hr','admin','owner'));

-- Salary: finance and admin/owner only.
create policy sal_all on employee_salaries for all using (has_role('finance','admin','owner'))
  with check (has_role('finance','admin','owner'));

-- Schedules: own; manager/hr/admin/owner see all; hr/admin/owner edit.
create policy sched_read on work_schedules for select using (
  employee_id = current_employee_id() or has_role('manager','hr','admin','owner'));
create policy sched_write on work_schedules for all using (has_role('hr','admin','owner'))
  with check (has_role('hr','admin','owner'));

-- Attendance: own; manager/hr/admin/owner see all. Writes only through clock_in/clock_out,
-- except HR/admin/owner corrections.
create policy att_read on attendance_logs for select using (
  employee_id = current_employee_id() or has_role('manager','hr','admin','owner'));
create policy att_correct on attendance_logs for update using (has_role('hr','admin','owner'))
  with check (has_role('hr','admin','owner'));

-- Audit: admin/owner read only; rows written by triggers.
create policy audit_read on audit_logs for select using (has_role('admin','owner'));
