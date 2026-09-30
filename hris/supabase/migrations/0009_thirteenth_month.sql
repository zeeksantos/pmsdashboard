-- 13th month pay = a second kind of payroll run, one per calendar year (Jan 1 - Dec 31).
alter table payroll_runs
  add column kind text not null default 'REGULAR' check (kind in ('REGULAR', 'THIRTEENTH_MONTH'));

-- A 13th month run must cover exactly one calendar year.
alter table payroll_runs add constraint payroll_runs_thirteenth_period check (
  kind = 'REGULAR'
  or (to_char(period_start, 'MM-DD') = '01-01' and to_char(period_end, 'MM-DD') = '12-31'
      and extract(year from period_start) = extract(year from period_end))
);

-- Basic pay actually earned in a calendar year, from FINALIZED regular runs, per employee.
-- Basic = BASIC earnings minus absence and late/undertime deductions. Allowances, bonuses,
-- and other manual lines are excluded. A run counts toward the year its period ENDS in.
-- Runs with the security of the caller: only payroll staff can see the rows behind this.
create or replace function thirteenth_month_basis(p_year int)
returns table (employee_id uuid, basic_pay numeric, absence_deduction numeric, late_deduction numeric,
               runs_counted int, first_period date, last_period date)
language sql stable as $$
  select p.employee_id,
         coalesce(sum(l.amount) filter (where l.kind = 'EARNING' and l.code = 'BASIC'), 0),
         coalesce(sum(l.amount) filter (where l.kind = 'DEDUCTION' and l.code = 'ABSENCE'), 0),
         coalesce(sum(l.amount) filter (where l.kind = 'DEDUCTION' and l.code = 'LATE'), 0),
         count(distinct r.id)::int,
         min(r.period_start), max(r.period_end)
    from payroll_runs r
    join payslips p on p.run_id = r.id
    join payslip_lines l on l.payslip_id = p.id
   where r.status = 'FINALIZED' and r.kind = 'REGULAR'
     and extract(year from r.period_end)::int = p_year
   group by p.employee_id;
$$;

revoke execute on function thirteenth_month_basis(int) from public, anon;
grant execute on function thirteenth_month_basis(int) to authenticated;
