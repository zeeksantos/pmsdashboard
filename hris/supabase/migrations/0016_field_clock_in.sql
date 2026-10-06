-- Time in from the field / out of office. Each attendance record says where the person worked:
-- OFFICE (default) or FIELD. A field time-in must say where and why (stored as a note).
-- GPS is still recorded either way. Lateness rules and payroll counting are unchanged.
alter table attendance_logs
  add column work_mode text not null default 'OFFICE' check (work_mode in ('OFFICE', 'FIELD')),
  add column field_note text check (field_note is null or length(field_note) <= 300),
  add constraint attendance_field_needs_note
    check (work_mode <> 'FIELD' or length(trim(coalesce(field_note, ''))) > 0);

-- The original clock_in(lat, lng, accuracy) is kept: it records an office time-in. The app uses this one.
create or replace function clock_in_with_mode(
  p_lat double precision, p_lng double precision, p_accuracy real, p_mode text, p_note text default null)
returns attendance_logs language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  now_mnl timestamp := now() at time zone 'Asia/Manila';
  today date := (now() at time zone 'Asia/Manila')::date;
  v_mode text := upper(coalesce(nullif(trim(p_mode), ''), 'OFFICE'));
  v_note text := nullif(trim(p_note), '');
  sched work_schedules;
  late int := 0;
  row attendance_logs;
begin
  if emp is null then raise exception 'No employee profile for this user'; end if;
  if v_mode not in ('OFFICE', 'FIELD') then raise exception 'Choose office or field'; end if;
  if v_mode = 'FIELD' and v_note is null then raise exception 'Say where you are working and why'; end if;
  if v_note is not null and length(v_note) > 300 then raise exception 'The note is too long (300 characters at most)'; end if;
  if v_mode = 'OFFICE' then v_note := null; end if;
  select * into sched from work_schedules
   where employee_id = emp and extract(dow from today)::int = any(days_of_week)
     and effective_from <= today and (effective_to is null or effective_to >= today)
   order by effective_from desc limit 1;
  if found then
    late := greatest(0, floor(extract(epoch from (now_mnl - (today + sched.start_time))) / 60)::int);
    if late <= 15 then late := 0; end if;
  end if;
  insert into attendance_logs (employee_id, work_date, time_in, in_lat, in_lng, in_accuracy_m, late_minutes, work_mode, field_note)
  values (emp, today, now(), p_lat, p_lng, p_accuracy, late, v_mode, v_note)
  returning * into row;
  return row;
exception when unique_violation then
  raise exception 'Already timed in today';
end $$;

revoke execute on function clock_in_with_mode(double precision, double precision, real, text, text) from public, anon;
grant execute on function clock_in_with_mode(double precision, double precision, real, text, text) to authenticated;
