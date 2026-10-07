-- Holiday pay: payroll_inputs_v2 returns everything payroll_inputs does, plus holiday counts per employee.
-- (The original payroll_inputs stays as it was; the app now calls this one.)
--
-- Holidays come from company_events (REGULAR_HOLIDAY / SPECIAL_HOLIDAY). Per employee and day:
--   working day, worked           -> reg_holiday_worked / spec_holiday_worked
--   rest day, worked              -> reg_rest_holiday_worked / spec_rest_holiday_worked
--   regular holiday, not worked   -> reg_holiday_paid_unworked, when the employee was present or on
--                                    paid leave on the working day before (skipping rest days and
--                                    other holidays), and has no approved leave on the holiday itself.
--                                    These days also stay inside absent_days; payroll subtracts them.
-- Special non-working days not worked stay absences (no work, no pay).

create or replace function holiday_kind_on(p_date date) returns company_event_kind
language sql stable security definer set search_path = public as $$
  select kind from company_events
   where kind in ('REGULAR_HOLIDAY', 'SPECIAL_HOLIDAY') and p_date between start_date and end_date
   order by (kind = 'REGULAR_HOLIDAY') desc
   limit 1;
$$;

create or replace function regular_holiday_entitled(p_emp uuid, p_date date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare pd date := p_date - 1; i int := 0;
begin
  while i < 14 loop
    if is_working_day(p_emp, pd) then
      if exists (select 1 from attendance_logs a where a.employee_id = p_emp and a.work_date = pd and a.time_in is not null)
         or exists (select 1 from leave_requests l join leave_types t on t.id = l.leave_type_id
                     where l.employee_id = p_emp and l.status = 'APPROVED' and t.is_paid
                       and pd between l.start_date and l.end_date) then
        return true;
      end if;
      -- Absent on an ordinary workday ends the chain; absent on a holiday looks one workday further back.
      if holiday_kind_on(pd) is null then return false; end if;
    end if;
    pd := pd - 1;
    i := i + 1;
  end loop;
  return false;
end $$;

create or replace function payroll_inputs_v2(p_start date, p_end date)
returns table (employee_id uuid, days_scheduled numeric, days_present numeric,
               paid_leave_days numeric, absent_days numeric,
               late_minutes int, undertime_minutes int,
               shift_hours numeric, days_per_week int,
               reg_holiday_worked numeric, spec_holiday_worked numeric,
               reg_holiday_paid_unworked numeric,
               reg_rest_holiday_worked numeric, spec_rest_holiday_worked numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  e record; d date; sched work_schedules;
  ds numeric; dp numeric; pl numeric; ab numeric;
  rw numeric; sw numeric; rpu numeric; rrw numeric; srw numeric;
  lv_found boolean; lv_half boolean; lv_paid boolean;
  late int; under int; hk company_event_kind; worked boolean;
begin
  if not has_role('finance', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_end < p_start or p_end - p_start > 62 then raise exception 'Invalid pay period'; end if;

  for e in select id, date_hired from employees where status = 'ACTIVE' and date_hired <= p_end loop
    ds := 0; dp := 0; pl := 0; ab := 0; rw := 0; sw := 0; rpu := 0; rrw := 0; srw := 0;
    for d in select g::date from generate_series(p_start, p_end, interval '1 day') g loop
      if d < e.date_hired then continue; end if;
      hk := holiday_kind_on(d);
      worked := exists (select 1 from attendance_logs a
                         where a.employee_id = e.id and a.work_date = d and a.time_in is not null);

      if not is_working_day(e.id, d) then
        -- Rest day: only matters when it is a holiday the employee worked.
        if hk is not null and worked then
          if hk = 'REGULAR_HOLIDAY' then rrw := rrw + 1; else srw := srw + 1; end if;
        end if;
        continue;
      end if;

      ds := ds + 1;
      if worked then
        dp := dp + 1;
        if hk = 'REGULAR_HOLIDAY' then rw := rw + 1;
        elsif hk = 'SPECIAL_HOLIDAY' then sw := sw + 1; end if;
      else
        lv_found := false;
        select true, l.half_day, t.is_paid into lv_found, lv_half, lv_paid
          from leave_requests l join leave_types t on t.id = l.leave_type_id
         where l.employee_id = e.id and l.status = 'APPROVED' and d between l.start_date and l.end_date
         order by t.is_paid desc limit 1;
        if coalesce(lv_found, false) and lv_paid then
          if lv_half then pl := pl + 0.5; ab := ab + 0.5; else pl := pl + 1; end if;
        else
          ab := ab + 1;   -- absent, or on unpaid leave
          if hk = 'REGULAR_HOLIDAY' and not coalesce(lv_found, false) and regular_holiday_entitled(e.id, d) then
            rpu := rpu + 1;
          end if;
        end if;
      end if;
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
    reg_holiday_worked := rw; spec_holiday_worked := sw; reg_holiday_paid_unworked := rpu;
    reg_rest_holiday_worked := rrw; spec_rest_holiday_worked := srw;
    return next;
  end loop;
end $$;

revoke execute on function holiday_kind_on(date), regular_holiday_entitled(uuid, date) from public, anon, authenticated;
revoke execute on function payroll_inputs_v2(date, date) from public, anon;
grant execute on function payroll_inputs_v2(date, date) to authenticated;
