import { createClient } from "@/lib/supabase/server";
import { leaveSummary, type LeaveRow, type SlipForLeave } from "@/lib/leave-report";

// Everything the leave pay summary needs for one run, or null when the run doesn't exist
// or is a 13th month run. Leave comes from approved leave as it stands now.
export async function loadLeaveReport(id: string) {
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id, kind, label, period_start, period_end, pay_date, status, options")
    .eq("id", id)
    .maybeSingle();
  if (!run || run.kind === "THIRTEENTH_MONTH") return null;

  const [{ data: slipData }, { data: leaveData }] = await Promise.all([
    supabase.from("payslips").select("employee_id, snapshot, employees(full_name, employee_no)").eq("run_id", id),
    supabase.rpc("payroll_leave_summary", { p_start: run.period_start, p_end: run.period_end }),
  ]);

  const slips: SlipForLeave[] = ((slipData ?? []) as unknown as {
    employee_id: string; snapshot: Record<string, unknown> | null;
    employees: { full_name: string; employee_no: string } | null;
  }[]).map((s) => ({
    employee_id: s.employee_id,
    name: s.employees?.full_name ?? "Unknown",
    employee_no: s.employees?.employee_no ?? "",
    snapshot: s.snapshot,
  }));
  const leave: LeaveRow[] = ((leaveData ?? []) as { employee_id: string; leave_type: string; is_paid: boolean; days: number | string }[])
    .map((l) => ({ employee_id: l.employee_id, leave_type: l.leave_type, is_paid: l.is_paid, days: Number(l.days) }));

  const opts = (run.options ?? {}) as Record<string, boolean>;
  const deductAbsences = opts.deduct_absences !== false;
  return { run, deductAbsences, summary: leaveSummary(slips, leave, deductAbsences) };
}
