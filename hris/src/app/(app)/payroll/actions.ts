"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { currentSalary } from "@/lib/salary";
import {
  RATES_VERSION, THIRTEENTH_MONTH_BASIS, computePayslip, computeThirteenthMonth, round2,
  type PayInputs, type RunOptions,
} from "@/lib/payroll";

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

  const fieldAllowanceRaw = String(fd.get("field_allowance") ?? "").trim();
  const fieldAllowance = fieldAllowanceRaw === "" ? 0 : round2(Number(fieldAllowanceRaw));
  if (!Number.isFinite(fieldAllowance) || fieldAllowance < 0 || fieldAllowance > 100000) {
    return "Enter the field allowance as an amount in pesos per day, or leave it blank for none.";
  }

  const options: RunOptions = {
    deduct_absences: fd.get("deduct_absences") === "on",
    deduct_late: fd.get("deduct_late") === "on",
    gov_contributions: fd.get("gov_contributions") === "on",
    withhold_tax: fd.get("withhold_tax") === "on",
    holiday_pay: fd.get("holiday_pay") === "on",
    field_allowance_per_day: fieldAllowance,
  };

  const supabase = await createClient();

  const { data: inputs, error: inputsError } = await supabase.rpc("payroll_inputs_v2", { p_start: start, p_end: end });
  if (inputsError) return inputsError.message;
  const rows = (inputs ?? []) as InputRow[];

  const { data: fieldRows, error: fieldError } = await supabase.rpc("payroll_field_days", { p_start: start, p_end: end });
  if (fieldError) return fieldError.message;
  const fieldDays = new Map(((fieldRows ?? []) as { employee_id: string; field_days: number }[]).map((f) => [f.employee_id, Number(f.field_days)]));

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
        reg_holiday_worked: Number(r.reg_holiday_worked ?? 0), spec_holiday_worked: Number(r.spec_holiday_worked ?? 0),
        reg_holiday_paid_unworked: Number(r.reg_holiday_paid_unworked ?? 0),
        reg_rest_holiday_worked: Number(r.reg_rest_holiday_worked ?? 0),
        spec_rest_holiday_worked: Number(r.spec_rest_holiday_worked ?? 0),
        field_days: fieldDays.get(r.employee_id) ?? 0,
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

type Basis = {
  employee_id: string; basic_pay: number; absence_deduction: number; late_deduction: number;
  runs_counted: number; first_period: string; last_period: string;
};

export async function createThirteenthRun(_prev: string | null, fd: FormData): Promise<string | null> {
  const me = await requirePayroll();
  if (!me) return "You don't have permission to run payroll.";

  const year = Number(fd.get("year"));
  const payDate = String(fd.get("pay_date") ?? "");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return "Enter a valid year.";
  if (!payDate) return "Enter the pay date.";

  const supabase = await createClient();

  // A 13th month based on incomplete figures would be wrong, so drafts for the year must be settled first.
  const { data: drafts } = await supabase
    .from("payroll_runs").select("id")
    .eq("kind", "REGULAR").eq("status", "DRAFT")
    .gte("period_end", `${year}-01-01`).lte("period_end", `${year}-12-31`);
  if (drafts?.length) {
    return `There ${drafts.length === 1 ? "is a draft payroll run" : `are ${drafts.length} draft payroll runs`} ending in ${year}. Finalize or delete ${drafts.length === 1 ? "it" : "them"} first so the 13th month uses complete figures.`;
  }

  const { data: basis, error: basisError } = await supabase.rpc("thirteenth_month_basis", { p_year: year });
  if (basisError) return basisError.message;
  const rows = (basis ?? []) as Basis[];
  if (!rows.length) return `No finalized payroll runs ended in ${year}. Finalize your regular runs for that year first.`;

  const computed = rows
    .map((r) => {
      const c = computeThirteenthMonth({
        basic_pay: Number(r.basic_pay), absence_deduction: Number(r.absence_deduction), late_deduction: Number(r.late_deduction),
      });
      return { r, c };
    })
    .filter((x) => x.c.amount > 0);
  if (!computed.length) return "Nobody has any basic pay earned for that year.";

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      kind: "THIRTEENTH_MONTH",
      label: String(fd.get("label") ?? "").trim() || `13th month pay ${year}`,
      period_start: `${year}-01-01`, period_end: `${year}-12-31`, pay_date: payDate,
      periods_per_month: 1, options: { thirteenth_month: true },
      rates_version: THIRTEENTH_MONTH_BASIS, created_by: me.userId,
    })
    .select("id")
    .single();
  if (runError) {
    return runError.message.includes("payroll_runs_period_start_period_end_key")
      ? `There's already a 13th month run for ${year}. Open it from the list, or delete the draft to start again.`
      : runError.message;
  }
  const fail = async (message: string) => {
    await supabase.from("payroll_runs").delete().eq("id", run.id);
    return message;
  };

  const { data: slips, error: slipError } = await supabase
    .from("payslips")
    .insert(computed.map(({ r, c }) => ({
      run_id: run.id, employee_id: r.employee_id,
      snapshot: {
        kind: "THIRTEENTH", year, basic_pay: Number(r.basic_pay), absence_deduction: Number(r.absence_deduction),
        late_deduction: Number(r.late_deduction), basic_earned: c.basicEarned, taxable_excess: c.taxableExcess,
        runs_counted: r.runs_counted, first_period: r.first_period, last_period: r.last_period,
      },
    })))
    .select("id, employee_id");
  if (slipError) return fail(slipError.message);

  const slipByEmp = new Map((slips ?? []).map((x) => [x.employee_id, x.id]));
  const { error: lineError } = await supabase.from("payslip_lines").insert(
    computed.map(({ r, c }) => ({
      payslip_id: slipByEmp.get(r.employee_id)!, kind: "EARNING", code: "THIRTEENTH", sort_order: 0,
      label: `13th month pay (₱${c.basicEarned.toLocaleString("en-PH", { minimumFractionDigits: 2 })} basic earned ÷ 12)`,
      amount: c.amount,
    }))
  );
  if (lineError) return fail(lineError.message);

  revalidatePath("/payroll");
  redirect(`/payroll/${run.id}`);
}

// Basic pay earned outside this system (e.g. before the HRIS was set up) still counts toward the 13th month.
export async function addPriorBasic(_prev: string | null, fd: FormData): Promise<string | null> {
  if (!(await requirePayroll())) return "Not allowed.";
  const payslipId = String(fd.get("payslip_id") ?? "");
  const basic = round2(Number(fd.get("basic")));
  if (!(basic > 0)) return "Enter the basic pay earned, greater than zero.";

  const supabase = await createClient();
  const { error } = await supabase.from("payslip_lines").insert({
    payslip_id: payslipId, kind: "EARNING", code: "THIRTEENTH_PRIOR", is_manual: true, sort_order: 500,
    label: `13th month on ₱${basic.toLocaleString("en-PH", { minimumFractionDigits: 2 })} basic earned elsewhere (÷ 12)`,
    amount: round2(basic / 12),
  });
  if (error) return error.message;
  revalidatePath("/payroll", "layout");
  return null;
}
