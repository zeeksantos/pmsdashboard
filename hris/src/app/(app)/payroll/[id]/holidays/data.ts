import { createClient } from "@/lib/supabase/server";
import { holidaySummary, type SlipForReport } from "@/lib/holiday-report";

export type PeriodHoliday = { title: string; kind: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY"; start_date: string; end_date: string };

// Everything the holiday pay summary needs for one run, or null when the run doesn't exist
// or is a 13th month run. Reads go through the signed-in user, so payroll rules still apply.
export async function loadHolidayReport(id: string) {
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id, kind, label, period_start, period_end, pay_date, status, options")
    .eq("id", id)
    .maybeSingle();
  if (!run || run.kind === "THIRTEENTH_MONTH") return null;

  const [{ data: slipData }, { data: holidayData }] = await Promise.all([
    supabase
      .from("payslips")
      .select("employee_id, snapshot, employees(full_name, employee_no), payslip_lines(code, amount)")
      .eq("run_id", id),
    supabase
      .from("company_events")
      .select("title, kind, start_date, end_date")
      .in("kind", ["REGULAR_HOLIDAY", "SPECIAL_HOLIDAY"])
      .lte("start_date", run.period_end)
      .gte("end_date", run.period_start)
      .order("start_date"),
  ]);

  const slips: SlipForReport[] = ((slipData ?? []) as unknown as {
    employee_id: string; snapshot: Record<string, unknown> | null;
    employees: { full_name: string; employee_no: string } | null;
    payslip_lines: { code: string; amount: number }[];
  }[]).map((s) => ({
    employee_id: s.employee_id,
    name: s.employees?.full_name ?? "Unknown",
    employee_no: s.employees?.employee_no ?? "",
    snapshot: s.snapshot,
    lines: s.payslip_lines.map((l) => ({ code: l.code, amount: Number(l.amount) })),
  }));

  const opts = (run.options ?? {}) as Record<string, boolean>;
  return {
    run,
    holidays: (holidayData ?? []) as PeriodHoliday[],
    summary: holidaySummary(slips, opts.holiday_pay === true),
  };
}
