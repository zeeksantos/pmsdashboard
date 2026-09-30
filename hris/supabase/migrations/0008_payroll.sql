-- Payroll. Runs are prepared as DRAFT, reviewed, then FINALIZED (locked).
-- Access: finance/admin/owner manage; an employee reads only their own FINALIZED payslips.

create type payroll_status as enum ('DRAFT', 'FINALIZED');

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  label text,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  periods_per_month smallint not null default 2 check (periods_per_month in (1, 2)),
  options jsonb not null default '{}',
  rates_version text,
  status payroll_status not null default 'DRAFT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  check (period_end >= period_start),
  unique (period_start, period_end)
);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete restrict,
  gross_pay numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_pay numeric(12,2) not null default 0,
  snapshot jsonb,                       -- the inputs the numbers were computed from
  unique (run_id, employee_id)
);
create index on payslips (employee_id);

-- kind: EARNING adds to gross, DEDUCTION subtracts, EMPLOYER is employer cost (informational).
create table payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,
  kind text not null check (kind in ('EARNING', 'DEDUCTION', 'EMPLOYER')),
  code text not null,
  label text not null,
  amount numeric(12,2) not null check (amount >= 0),
  is_manual boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on payslip_lines (payslip_id);

-- Totals are always derived from the lines, in one place.
create or replace function recompute_payslip_totals() returns trigger
language plpgsql as $$
declare
  pid uuid := coalesce(new.payslip_id, old.payslip_id);
  g numeric(12,2);
  d numeric(12,2);
begin
  select coalesce(sum(amount) filter (where kind = 'EARNING'), 0),
         coalesce(sum(amount) filter (where kind = 'DEDUCTION'), 0)
    into g, d from payslip_lines where payslip_id = pid;
  update payslips set gross_pay = g, total_deductions = d, net_pay = g - d where id = pid;
  return null;
end $$;
create trigger payslip_lines_totals after insert or update or delete on payslip_lines
  for each row execute function recompute_payslip_totals();

-- Finalized runs are locked: no edits to the run, its payslips, or its lines.
create or replace function lock_finalized_run() returns trigger
language plpgsql as $$
begin
  if old.status = 'FINALIZED' and coalesce(current_setting('hris.payroll_reopen', true), '') <> 'on' then
    raise exception 'This payroll run is finalized and can''t be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger payroll_runs_lock before update or delete on payroll_runs
  for each row execute function lock_finalized_run();

create or replace function lock_finalized_payslips() returns trigger
language plpgsql as $$
declare st payroll_status;
begin
  select status into st from payroll_runs where id = coalesce(new.run_id, old.run_id);
  if st = 'FINALIZED' then raise exception 'This payroll run is finalized and can''t be changed'; end if;
  return coalesce(new, old);
end $$;
create trigger payslips_lock before insert or update or delete on payslips
  for each row execute function lock_finalized_payslips();

create or replace function lock_finalized_lines() returns trigger
language plpgsql as $$
declare st payroll_status;
begin
  select r.status into st from payslips p join payroll_runs r on r.id = p.run_id
   where p.id = coalesce(new.payslip_id, old.payslip_id);
  if st = 'FINALIZED' then raise exception 'This payroll run is finalized and can''t be changed'; end if;
  return coalesce(new, old);
end $$;
create trigger payslip_lines_lock before insert or update or delete on payslip_lines
  for each row execute function lock_finalized_lines();

-- Finalize / reopen ---------------------------------------------------------
create or replace function finalize_payroll_run(p_run uuid) returns payroll_runs
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  if not has_role('finance', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  select * into r from payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if r.status <> 'DRAFT' then raise exception 'This run is already finalized'; end if;
  if not exists (select 1 from payslips where run_id = p_run) then
    raise exception 'This run has no payslips';
  end if;
  update payroll_runs set status = 'FINALIZED', finalized_by = auth.uid(), finalized_at = now()
   where id = p_run returning * into r;
  return r;
end $$;

create or replace function reopen_payroll_run(p_run uuid) returns payroll_runs
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  if not has_role('admin', 'owner') then raise exception 'Only an admin or owner can reopen a payroll run'; end if;
  select * into r from payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if r.status <> 'FINALIZED' then raise exception 'This run isn''t finalized'; end if;
  perform set_config('hris.payroll_reopen', 'on', true);
  update payroll_runs set status = 'DRAFT', finalized_by = null, finalized_at = null
   where id = p_run returning * into r;
  perform set_config('hris.payroll_reopen', 'off', true);
  return r;
end $$;

-- Attendance/leave facts for a pay period, as totals only (finance can't read
-- the attendance or leave tables directly, so this is the narrow window they get).
create or replace function payroll_inputs(p_start date, p_end date)
returns table (employee_id uuid, days_scheduled numeric, days_present numeric,
               paid_leave_days numeric, absent_days numeric,
               late_minutes int, undertime_minutes int,
               shift_hours numeric, days_per_week int)
language plpgsql stable security definer set search_path = public as $$
declare
  e record; d date; sched work_schedules;
  ds numeric; dp numeric; pl numeric; ab numeric;
  lv_found boolean; lv_half boolean; lv_paid boolean;
  late int; under int;
begin
  if not has_role('finance', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_end < p_start or p_end - p_start > 62 then raise exception 'Invalid pay period'; end if;

  for e in select id, date_hired from employees where status = 'ACTIVE' and date_hired <= p_end loop
    ds := 0; dp := 0; pl := 0; ab := 0;
    for d in select g::date from generate_series(p_start, p_end, interval '1 day') g loop
      if d < e.date_hired or not is_working_day(e.id, d) then continue; end if;
      ds := ds + 1;
      if exists (select 1 from attendance_logs a
                  where a.employee_id = e.id and a.work_date = d and a.time_in is not null) then
        dp := dp + 1;
      else
        select true, l.half_day, t.is_paid into lv_found, lv_half, lv_paid
          from leave_requests l join leave_types t on t.id = l.leave_type_id
         where l.employee_id = e.id and l.status = 'APPROVED' and d between l.start_date and l.end_date
         order by t.is_paid desc limit 1;
        if coalesce(lv_found, false) and lv_paid then
          if lv_half then pl := pl + 0.5; ab := ab + 0.5; else pl := pl + 1; end if;
        else
          ab := ab + 1;   -- absent, or on unpaid leave
        end if;
      end if;
      lv_found := false;
    end loop;

    select coalesce(sum(a.late_minutes), 0), coalesce(sum(a.undertime_minutes), 0)
      into late, under from attendance_logs a
     where a.employee_id = e.id and a.work_date between p_start and p_end;

    select * into sched from work_schedules w
     where w.employee_id = e.id and w.effective_from <= p_end
       and (w.effective_to is null or w.effective_to >= p_end)
     order by w.effective_from desc limit 1;

    employee_id := e.id; days_scheduled := ds; days_present := dp;
    paid_leave_days := pl; absent_days := ab; late_minutes := late; undertime_minutes := under;
    shift_hours := case when sched.id is null then 8
                        else round(extract(epoch from (sched.end_time - sched.start_time)) / 3600.0, 2) end;
    days_per_week := case when sched.id is null then 5 else coalesce(array_length(sched.days_of_week, 1), 5) end;
    return next;
  end loop;
end $$;

-- Helpers so employee-facing policies don't recurse through each other's RLS.
create or replace function run_is_finalized(p_run uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payroll_runs where id = p_run and status = 'FINALIZED');
$$;
create or replace function is_my_finalized_payslip(p_payslip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payslips p join payroll_runs r on r.id = p.run_id
                  where p.id = p_payslip and p.employee_id = current_employee_id()
                    and r.status = 'FINALIZED');
$$;
create or replace function is_my_finalized_run(p_run uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payslips p join payroll_runs r on r.id = p.run_id
                  where r.id = p_run and p.employee_id = current_employee_id()
                    and r.status = 'FINALIZED');
$$;

revoke execute on function finalize_payroll_run(uuid), reopen_payroll_run(uuid),
  payroll_inputs(date, date) from public, anon;
grant execute on function finalize_payroll_run(uuid), reopen_payroll_run(uuid),
  payroll_inputs(date, date), run_is_finalized(uuid), is_my_finalized_payslip(uuid),
  is_my_finalized_run(uuid) to authenticated;

-- RLS + audit ---------------------------------------------------------------
alter table payroll_runs   enable row level security;
alter table payslips       enable row level security;
alter table payslip_lines  enable row level security;

create policy runs_staff on payroll_runs for all
  using (has_role('finance', 'admin', 'owner')) with check (has_role('finance', 'admin', 'owner'));
create policy runs_own_read on payroll_runs for select using (is_my_finalized_run(id));

create policy slips_staff on payslips for all
  using (has_role('finance', 'admin', 'owner')) with check (has_role('finance', 'admin', 'owner'));
create policy slips_own_read on payslips for select
  using (employee_id = current_employee_id() and run_is_finalized(run_id));

create policy lines_staff on payslip_lines for all
  using (has_role('finance', 'admin', 'owner')) with check (has_role('finance', 'admin', 'owner'));
create policy lines_own_read on payslip_lines for select using (is_my_finalized_payslip(payslip_id));

create trigger audit_payroll_runs  after insert or update or delete on payroll_runs
  for each row execute function audit_row();
create trigger audit_payslips      after insert or update or delete on payslips
  for each row execute function audit_row();
create trigger audit_payslip_lines after insert or update or delete on payslip_lines
  for each row execute function audit_row();
