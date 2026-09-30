"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { currentSalary } from "@/lib/salary";
import { RATES_VERSION, computePayslip, round2, type PayInputs, type RunOptions } from "@/lib/payroll";

type InputRow = PayInputs & { employee_id: string };

async function requirePayroll() {
  const me = await getCurrentUser();
  return me && canManagePayroll(me.role) ? me : null;
}

export async function createRun(_prev: string | null, fd: FormData): Promise<string | null> {
  const me = await requirePayroll();
  if (!me) return "You don't have permission to run payroll.";

  const start = String(fd.get("period_start") ?? "");
  const end = String(fd.get("period_end") ?? "");
  const payDate = String(fd.get("pay_date") ?? "");
  const periods = Number(fd.get("periods_per_month")) === 1 ? 1 : 2;
  if (!start || !end || !payDate) return "Enter the period start, period end and pay date.";
  if (end < start) return "The period end is before the start.";
  if (Date.parse(end) - Date.parse(start) > 62 * 86_400_000) return "A pay period can't be longer than about two months.";

  const options: RunOptions = {
    deduct_absences: fd.get("deduct_absences") === "on",
    deduct_late: fd.get("deduct_late") === "on",
    gov_contributions: fd.get("gov_contributions") === "on",
    withhold_tax: fd.get("withhold_tax") === "on",
  };

  const supabase = await createClient();

  const { data: inputs, error: inputsError } = await supabase.rpc("payroll_inputs", { p_start: start, p_end: end });
  if (inputsError) return inputsError.message;
  const rows = (inputs ?? []) as InputRow[];

  const { data: salaries, error: salaryError } = await supabase
    .from("employee_salaries")
    .select("employee_id, monthly_rate, hourly_rate, effective_from");
  if (salaryError) return salaryError.message;
  const byEmp = new Map<string, NonNullable<typeof salaries>>();
  for (const s of salaries ?? []) byEmp.set(s.employee_id, [...(byEmp.get(s.employee_id) ?? []), s]);

  const computed = rows.flatMap((r) => {
    const pay = currentSalary(byEmp.get(r.employee_id) ?? [], end);
    if (!pay) return [];
    const result = computePayslip({
      monthlyRate: pay.monthly_rate == null ? null : Number(pay.monthly_rate),
      hourlyRate: pay.hourly_rate == null ? null : Number(pay.hourly_rate),
      periodsPerMonth: periods,
      inputs: {
        days_scheduled: Number(r.days_scheduled), days_present: Number(r.days_present),
        paid_leave_days: Number(r.paid_leave_days), absent_days: Number(r.absent_days),
        late_minutes: Number(r.late_minutes), undertime_minutes: Number(r.undertime_minutes),
        shift_hours: Number(r.shift_hours), days_per_week: Number(r.days_per_week),
      },
      options,
    });
    return [{ employee_id: r.employee_id, result }];
  });
  if (!computed.length) return "No active employees have a salary set for that period.";

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      label: String(fd.get("label") ?? "").trim() || null,
      period_start: start, period_end: end, pay_date: payDate,
      periods_per_month: periods, options, rates_version: RATES_VERSION,
      created_by: me.userId,
    })
    .select("id")
    .single();
  if (runError) {
    return runError.message.includes("payroll_runs_period_start_period_end_key")
      ? "There's already a payroll run for that exact period."
      : runError.message;
  }

  const fail = async (message: string) => {
    await supabase.from("payroll_runs").delete().eq("id", run.id); // don't leave a half-built run
    return message;
  };

  const { data: slips, error: slipError } = await supabase
    .from("payslips")
    .insert(computed.map((c) => ({ run_id: run.id, employee_id: c.employee_id, snapshot: c.result.snapshot })))
    .select("id, employee_id");
  if (slipError) return fail(slipError.message);

  const slipByEmp = new Map((slips ?? []).map((s) => [s.employee_id, s.id]));
  const lines = computed.flatMap((c) =>
    c.result.lines.map((l, idx) => ({
      payslip_id: slipByEmp.get(c.employee_id)!,
      kind: l.kind, code: l.code, label: l.label, amount: l.amount, sort_order: idx,
    }))
  );
  const { error: lineError } = await supabase.from("payslip_lines").insert(lines);
  if (lineError) return fail(lineError.message);

  revalidatePath("/payroll");
  redirect(`/payroll/${run.id}`);
}

export async function addLine(_prev: string | null, fd: FormData): Promise<string | null> {
  if (!(await requirePayroll())) return "Not allowed.";
  const payslipId = String(fd.get("payslip_id") ?? "");
  const kind = fd.get("kind") === "DEDUCTION" ? "DEDUCTION" : "EARNING";
  const label = String(fd.get("label") ?? "").trim();
  const amount = round2(Number(fd.get("amount")));
  if (!label) return "Enter a description.";
  if (!(amount > 0)) return "Enter an amount greater than zero.";

  const supabase = await createClient();
  const { error } = await supabase.from("payslip_lines").insert({
    payslip_id: payslipId, kind, code: "MANUAL", label, amount, is_manual: true, sort_order: 999,
  });
  if (error) return error.message;
  revalidatePath("/payroll", "layout");
  return null;
}

export async function deleteLine(_prev: string | null, fd: FormData): Promise<string | null> {
  if (!(await requirePayroll())) return "Not allowed.";
  const supabase = await createClient();
  const { error } = await supabase.from("payslip_lines").delete().eq("id", String(fd.get("id") ?? ""));
  if (error) return error.message;
  revalidatePath("/payroll", "layout");
  return null;
}

export async function finalizeRun(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_payroll_run", { p_run: String(fd.get("id") ?? "") });
  if (error) return error.message;
  revalidatePath("/payroll", "layout");
  return null;
}

export async function reopenRun(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_payroll_run", { p_run: String(fd.get("id") ?? "") });
  if (error) return error.message;
  revalidatePath("/payroll", "layout");
  return null;
}

export async function deleteRun(_prev: string | null, fd: FormData): Promise<string | null> {
  if (!(await requirePayroll())) return "Not allowed.";
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_runs").delete().eq("id", String(fd.get("id") ?? ""));
  if (error) return error.message;
  revalidatePath("/payroll", "layout");
  redirect("/payroll");
}
