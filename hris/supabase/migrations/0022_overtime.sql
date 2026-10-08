-- Overtime: staff file a request for hours worked beyond their shift on a day they timed in;
-- a manager (their own reports) or HR/admin/owner approves it; payroll pays only APPROVED hours.
-- Like leave, all writes go through the functions below.

create table overtime_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  hours numeric(4,2) not null check (hours > 0 and hours <= 12),
  reason text,
  status leave_status not null default 'PENDING',
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text
);
create index on overtime_requests (employee_id, work_date);
create index on overtime_requests (status);
-- One live request per person per day.
create unique index overtime_one_live_per_day on overtime_requests (employee_id, work_date)
  where status in ('PENDING', 'APPROVED');

create or replace function request_overtime(p_date date, p_hours numeric, p_reason text)
returns overtime_requests language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  today date := (now() at time zone 'Asia/Manila')::date;
  row overtime_requests;
begin
  if emp is null then raise exception 'No employee profile for this user'; end if;
  if p_date is null then raise exception 'Choose the date you worked overtime'; end if;
  if p_date > today then raise exception 'You can''t file overtime for a future date'; end if;
  if p_date < today - 45 then raise exception 'That date is too long ago to file. Ask HR.'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 12 then
    raise exception 'Enter overtime hours between 0.25 and 12';
  end if;
  if not exists (select 1 from attendance_logs a
                  where a.employee_id = emp and a.work_date = p_date and a.time_in is not null) then
    raise exception 'You have no time-in on that date, so overtime can''t be filed for it';
  end if;
  if exists (select 1 from overtime_requests
              where employee_id = emp and work_date = p_date and status in ('PENDING', 'APPROVED')) then
    raise exception 'You already have an overtime request for that date';
  end if;
  insert into overtime_requests (employee_id, work_date, hours, reason)
  values (emp, p_date, round(p_hours, 2), nullif(trim(p_reason), ''))
  returning * into row;
  return row;
end $$;

create or replace function decide_overtime(p_request uuid, p_approve boolean, p_note text)
returns overtime_requests language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_employee_id();
  r overtime_requests;
begin
  select * into r from overtime_requests where id = p_request for update;
  if not found then raise exception 'Overtime request not found'; end if;
  if r.status <> 'PENDING' then raise exception 'This request has already been %', lower(r.status::text); end if;
  if not (has_role('hr', 'admin', 'owner') or is_manager_of(r.employee_id)) then
    raise exception 'Not allowed to decide this request';
  end if;
  if r.employee_id = me and not has_role('owner') then
    raise exception 'You can''t decide your own overtime request';
  end if;
  update overtime_requests
     set status = case when p_approve then 'APPROVED'::leave_status else 'REJECTED'::leave_status end,
         decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
   where id = p_request returning * into r;
  return r;
end $$;

create or replace function cancel_overtime(p_request uuid) returns overtime_requests
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_employee_id();
  r overtime_requests;
begin
  select * into r from overtime_requests where id = p_request for update;
  if not found then raise exception 'Overtime request not found'; end if;
  if r.status not in ('PENDING', 'APPROVED') then
    raise exception 'This request is already %', lower(r.status::text);
  end if;
  if has_role('hr', 'admin', 'owner') then
    null;
  elsif r.employee_id = me and r.status = 'PENDING' then
    null;
  else
    raise exception 'Not allowed to cancel this request';
  end if;
  update overtime_requests set status = 'CANCELLED' where id = p_request returning * into r;
  return r;
end $$;

-- Approved overtime for a pay period with the kind of day it fell on, for payroll managers only
-- (finance can't read the overtime or attendance tables directly).
--   ORDINARY | REST | SPECIAL | SPECIAL_REST | REGULAR | REGULAR_REST
create or replace function payroll_overtime(p_start date, p_end date)
returns table (employee_id uuid, work_date date, hours numeric, day_kind text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('finance', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_end < p_start or p_end - p_start > 62 then raise exception 'Invalid pay period'; end if;
  return query
    select o.employee_id, o.work_date, o.hours,
           case holiday_kind_on(o.work_date)
             when 'REGULAR_HOLIDAY' then case when is_working_day(o.employee_id, o.work_date) then 'REGULAR' else 'REGULAR_REST' end
             when 'SPECIAL_HOLIDAY' then case when is_working_day(o.employee_id, o.work_date) then 'SPECIAL' else 'SPECIAL_REST' end
             else case when is_working_day(o.employee_id, o.work_date) then 'ORDINARY' else 'REST' end
           end
      from overtime_requests o
      join employees e on e.id = o.employee_id
     where o.status = 'APPROVED' and e.status = 'ACTIVE'
       and o.work_date between p_start and p_end
     order by o.employee_id, o.work_date;
end $$;

-- Same as thirteenth_month_basis plus the overtime pay lines (new name: the old return type stays).
create or replace function thirteenth_month_basis_v2(p_year int)
returns table (employee_id uuid, basic_pay numeric, absence_deduction numeric, late_deduction numeric,
               runs_counted int, first_period date, last_period date, overtime_pay numeric)
language sql stable set search_path = public as $$
  select p.employee_id,
         coalesce(sum(l.amount) filter (where l.kind = 'EARNING' and l.code = 'BASIC'), 0),
         coalesce(sum(l.amount) filter (where l.kind = 'DEDUCTION' and l.code = 'ABSENCE'), 0),
         coalesce(sum(l.amount) filter (where l.kind = 'DEDUCTION' and l.code = 'LATE'), 0),
         count(distinct r.id)::int,
         min(r.period_start), max(r.period_end),
         coalesce(sum(l.amount) filter (where l.kind = 'EARNING' and l.code = 'OVERTIME'), 0)
    from payroll_runs r
    join payslips p on p.run_id = r.id
    join payslip_lines l on l.payslip_id = p.id
   where r.status = 'FINALIZED' and r.kind = 'REGULAR'
     and extract(year from r.period_end)::int = p_year
   group by p.employee_id;
$$;

revoke execute on function request_overtime(date, numeric, text), decide_overtime(uuid, boolean, text),
  cancel_overtime(uuid), payroll_overtime(date, date), thirteenth_month_basis_v2(int) from public, anon;
grant execute on function request_overtime(date, numeric, text), decide_overtime(uuid, boolean, text),
  cancel_overtime(uuid), payroll_overtime(date, date), thirteenth_month_basis_v2(int) to authenticated;

-- RLS + audit: read-only for people; changes only through the functions above.
alter table overtime_requests enable row level security;
create policy ot_read on overtime_requests for select using (
  employee_id = current_employee_id() or is_manager_of(employee_id)
  or has_role('hr', 'admin', 'owner'));
create trigger audit_overtime_requests after insert or update or delete on overtime_requests
  for each row execute function audit_row();
