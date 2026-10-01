-- Leave management. All writes to leave_requests go through the functions below,
-- which enforce balances, overlaps, and who may approve.

create type leave_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_days numeric(5,1) not null default 0 check (default_days >= 0),
  has_balance boolean not null default true,   -- false = no cap (e.g. unpaid leave)
  is_paid boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Placeholder policy: edit these in the app (Leave settings).
insert into leave_types (name, default_days, has_balance, is_paid) values
  ('Vacation Leave', 5, true, true),
  ('Sick Leave', 5, true, true),
  ('Emergency Leave', 3, true, true),
  ('Unpaid Leave', 0, false, false);

-- Per-employee override of a type's yearly allowance.
create table leave_allocations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year int not null,
  days numeric(5,1) not null check (days >= 0),
  unique (employee_id, leave_type_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  days numeric(4,1) not null check (days > 0),
  reason text,
  status leave_status not null default 'PENDING',
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  check (end_date >= start_date),
  check (not half_day or start_date = end_date)
);
create index on leave_requests (employee_id, start_date);
create index on leave_requests (status);

-- Internal helpers ------------------------------------------------------------
create or replace function is_manager_of(p_employee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees e
                 where e.id = p_employee and e.reports_to is not null
                   and e.reports_to = current_employee_id());
$$;

-- Working day per the employee's schedule in force; Mon-Fri if none is set.
create or replace function is_working_day(p_employee uuid, p_date date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare sched work_schedules; dow int := extract(dow from p_date)::int;
begin
  select * into sched from work_schedules
   where employee_id = p_employee and effective_from <= p_date
     and (effective_to is null or effective_to >= p_date)
   order by effective_from desc limit 1;
  if found then return dow = any(sched.days_of_week); end if;
  return dow between 1 and 5;
end $$;

create or replace function count_leave_days(p_employee uuid, p_start date, p_end date, p_half boolean)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare d date; n numeric := 0;
begin
  if p_end < p_start then raise exception 'End date is before the start date'; end if;
  if p_end - p_start > 365 then raise exception 'That date range is too long'; end if;
  if extract(year from p_start) <> extract(year from p_end) then
    raise exception 'A request can''t span two years. Split it into two requests.';
  end if;
  if p_half and p_start <> p_end then raise exception 'A half day must be a single date'; end if;
  for d in select g::date from generate_series(p_start, p_end, interval '1 day') g loop
    if is_working_day(p_employee, d) then n := n + 1; end if;
  end loop;
  if n = 0 then raise exception 'No working days in that range'; end if;
  return case when p_half then 0.5 else n end;
end $$;

create or replace function leave_allowance(p_employee uuid, p_type uuid, p_year int) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select days from leave_allocations
      where employee_id = p_employee and leave_type_id = p_type and year = p_year),
    (select default_days from leave_types where id = p_type));
$$;

create or replace function leave_used(p_employee uuid, p_type uuid, p_year int, p_status leave_status)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(days), 0) from leave_requests
   where employee_id = p_employee and leave_type_id = p_type and status = p_status
     and extract(year from start_date)::int = p_year;
$$;

-- Public API ----------------------------------------------------------------
create or replace function preview_leave_days(p_start date, p_end date, p_half boolean)
returns numeric language plpgsql stable security definer set search_path = public as $$
begin
  if current_employee_id() is null then raise exception 'No employee profile for this user'; end if;
  return count_leave_days(current_employee_id(), p_start, p_end, p_half);
end $$;

create or replace function request_leave(
  p_type uuid, p_start date, p_end date, p_half boolean, p_reason text)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  lt leave_types;
  n numeric;
  yr int := extract(year from p_start)::int;
  remaining numeric;
  row leave_requests;
begin
  if emp is null then raise exception 'No employee profile for this user'; end if;
  select * into lt from leave_types where id = p_type and active;
  if not found then raise exception 'Unknown or inactive leave type'; end if;

  n := count_leave_days(emp, p_start, p_end, coalesce(p_half, false));

  if exists (select 1 from leave_requests
              where employee_id = emp and status in ('PENDING', 'APPROVED')
                and start_date <= p_end and end_date >= p_start) then
    raise exception 'You already have a leave request that overlaps those dates';
  end if;

  if lt.has_balance then
    remaining := leave_allowance(emp, p_type, yr)
               - leave_used(emp, p_type, yr, 'APPROVED')
               - leave_used(emp, p_type, yr, 'PENDING');
    if n > remaining then
      raise exception 'Not enough % balance: % day(s) left, % requested', lt.name, remaining, n;
    end if;
  end if;

  insert into leave_requests (employee_id, leave_type_id, start_date, end_date, half_day, days, reason)
  values (emp, p_type, p_start, p_end, coalesce(p_half, false), n, nullif(trim(p_reason), ''))
  returning * into row;
  return row;
end $$;

create or replace function decide_leave(p_request uuid, p_approve boolean, p_note text)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_employee_id();
  r leave_requests;
  lt leave_types;
  yr int;
begin
  select * into r from leave_requests where id = p_request for update;
  if not found then raise exception 'Leave request not found'; end if;
  if r.status <> 'PENDING' then raise exception 'This request has already been %', lower(r.status::text); end if;
  if not (has_role('hr', 'admin', 'owner') or is_manager_of(r.employee_id)) then
    raise exception 'Not allowed to decide this request';
  end if;
  if r.employee_id = me and not has_role('owner') then
    raise exception 'You can''t decide your own leave request';
  end if;

  if p_approve then
    select * into lt from leave_types where id = r.leave_type_id;
    yr := extract(year from r.start_date)::int;
    if lt.has_balance and r.days > leave_allowance(r.employee_id, r.leave_type_id, yr)
                                   - leave_used(r.employee_id, r.leave_type_id, yr, 'APPROVED') then
      raise exception 'Not enough balance left to approve this request';
    end if;
  end if;

  update leave_requests
     set status = case when p_approve then 'APPROVED'::leave_status else 'REJECTED'::leave_status end,
         decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
   where id = p_request returning * into r;
  return r;
end $$;

create or replace function cancel_leave(p_request uuid) returns leave_requests
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_employee_id();
  r leave_requests;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into r from leave_requests where id = p_request for update;
  if not found then raise exception 'Leave request not found'; end if;
  if r.status not in ('PENDING', 'APPROVED') then
    raise exception 'This request is already %', lower(r.status::text);
  end if;
  if has_role('hr', 'admin', 'owner') then
    null;
  elsif r.employee_id = me then
    if r.status = 'APPROVED' and r.start_date < today then
      raise exception 'Leave that has already started can only be cancelled by HR';
    end if;
  else
    raise exception 'Not allowed to cancel this request';
  end if;
  update leave_requests set status = 'CANCELLED' where id = p_request returning * into r;
  return r;
end $$;

-- Balances for one employee/year: self, their manager, or HR/admin/owner.
create or replace function leave_balances(p_employee uuid, p_year int)
returns table (leave_type_id uuid, name text, has_balance boolean, is_paid boolean,
               allowance numeric, used numeric, pending numeric, remaining numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (p_employee = current_employee_id() or is_manager_of(p_employee)
          or has_role('hr', 'admin', 'owner')) then
    raise exception 'Not allowed';
  end if;
  return query
    select t.id, t.name, t.has_balance, t.is_paid,
           leave_allowance(p_employee, t.id, p_year),
           leave_used(p_employee, t.id, p_year, 'APPROVED'),
           leave_used(p_employee, t.id, p_year, 'PENDING'),
           leave_allowance(p_employee, t.id, p_year)
             - leave_used(p_employee, t.id, p_year, 'APPROVED')
             - leave_used(p_employee, t.id, p_year, 'PENDING')
      from leave_types t where t.active order by t.name;
end $$;

-- Who is on approved leave on a date (ids only; no reasons). For attendance views.
create or replace function employees_on_leave(p_date date) returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('manager', 'hr', 'admin', 'owner') then return; end if;
  return query select distinct employee_id from leave_requests
                where status = 'APPROVED' and p_date between start_date and end_date;
end $$;

-- Internal helpers are only called from the security-definer functions above.
-- is_manager_of stays callable: the lr_read policy runs it as the signed-in user
-- (it only answers "does the current user manage this employee?").
revoke execute on function is_working_day(uuid, date),
  count_leave_days(uuid, date, date, boolean), leave_allowance(uuid, uuid, int),
  leave_used(uuid, uuid, int, leave_status) from public, anon, authenticated;
revoke execute on function is_manager_of(uuid) from public, anon;
grant execute on function is_manager_of(uuid) to authenticated;
revoke execute on function preview_leave_days(date, date, boolean),
  request_leave(uuid, date, date, boolean, text), decide_leave(uuid, boolean, text),
  cancel_leave(uuid), leave_balances(uuid, int), employees_on_leave(date) from public, anon;
grant execute on function preview_leave_days(date, date, boolean),
  request_leave(uuid, date, date, boolean, text), decide_leave(uuid, boolean, text),
  cancel_leave(uuid), leave_balances(uuid, int), employees_on_leave(date) to authenticated;

-- RLS + audit ---------------------------------------------------------------
alter table leave_types       enable row level security;
alter table leave_allocations enable row level security;
alter table leave_requests    enable row level security;

create policy lt_read  on leave_types for select using (auth.uid() is not null);
create policy lt_write on leave_types for all using (has_role('hr', 'admin', 'owner'))
  with check (has_role('hr', 'admin', 'owner'));

create policy la_read on leave_allocations for select using (
  employee_id = current_employee_id() or has_role('hr', 'admin', 'owner'));
create policy la_write on leave_allocations for all using (has_role('hr', 'admin', 'owner'))
  with check (has_role('hr', 'admin', 'owner'));

-- Read only: own requests, their direct reports' requests, or everything for HR/admin/owner.
-- No insert/update/delete policy: changes happen only via the functions above.
create policy lr_read on leave_requests for select using (
  employee_id = current_employee_id() or is_manager_of(employee_id)
  or has_role('hr', 'admin', 'owner'));

create trigger audit_leave_types       after insert or update or delete on leave_types
  for each row execute function audit_row();
create trigger audit_leave_allocations after insert or update or delete on leave_allocations
  for each row execute function audit_row();
create trigger audit_leave_requests    after insert or update or delete on leave_requests
  for each row execute function audit_row();
