-- Tighten who can call database functions (from Supabase's security advisor).

-- Pin the search path on functions that didn't have one.
alter function public.audit_immutable() set search_path = public;
alter function public.recompute_payslip_totals() set search_path = public;
alter function public.lock_finalized_run() set search_path = public;
alter function public.lock_finalized_payslips() set search_path = public;
alter function public.lock_finalized_lines() set search_path = public;
alter function public.thirteenth_month_basis(int) set search_path = public;

-- These are only for signed-in users (the security rules and the time clock call them).
-- Without this, anyone with the public website key could call them without signing in.
revoke execute on function
  public.has_role(public.hris_role[]), public.current_hris_role(), public.current_employee_id(),
  public.run_is_finalized(uuid), public.is_my_finalized_payslip(uuid), public.is_my_finalized_run(uuid),
  public.clock_in(double precision, double precision, real),
  public.clock_out(double precision, double precision, real)
  from public, anon;
grant execute on function
  public.has_role(public.hris_role[]), public.current_hris_role(), public.current_employee_id(),
  public.run_is_finalized(uuid), public.is_my_finalized_payslip(uuid), public.is_my_finalized_run(uuid),
  public.clock_in(double precision, double precision, real),
  public.clock_out(double precision, double precision, real)
  to authenticated;

-- The audit trigger function is only ever run by triggers. Nobody needs to call it directly.
revoke execute on function public.audit_row() from public, anon, authenticated;
