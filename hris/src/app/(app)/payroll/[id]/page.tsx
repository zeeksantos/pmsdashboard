import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { formatDate, formatDateTime, formatPeso } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteRun, finalizeRun, reopenRun } from "../actions";

type Slip = {
  id: string; employee_id: string; gross_pay: number; total_deductions: number; net_pay: number;
  employees: { full_name: string; employee_no: string } | null;
  payslip_lines: { kind: string; amount: number }[];
};

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) notFound();

  const supabase = await createClient();
  const [{ data: run }, { data: slipData }, { data: active }] = await Promise.all([
    supabase.from("payroll_runs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("payslips")
      .select("id, employee_id, gross_pay, total_deductions, net_pay, employees(full_name, employee_no), payslip_lines(kind, amount)")
      .eq("run_id", id),
    supabase.from("employees").select("id, full_name").eq("status", "ACTIVE").order("full_name"),
  ]);
  if (!run) notFound();
  const slips = ((slipData ?? []) as unknown as Slip[]).sort((a, b) =>
    (a.employees?.full_name ?? "").localeCompare(b.employees?.full_name ?? ""));

  const sum = (f: (s: Slip) => number) => slips.reduce((t, s) => t + f(s), 0);
  const employerCost = sum((s) => s.payslip_lines.filter((l) => l.kind === "EMPLOYER").reduce((t, l) => t + Number(l.amount), 0));
  const included = new Set(slips.map((s) => s.employee_id));
  const missing = (active ?? []).filter((e) => !included.has(e.id));
  const draft = run.status === "DRAFT";
  const opts = (run.options ?? {}) as Record<string, boolean>;
  const on = Object.entries({
    "absences": opts.deduct_absences, "late/undertime": opts.deduct_late,
    "SSS/PhilHealth/Pag-IBIG": opts.gov_contributions, "income tax": opts.withhold_tax,
  }).filter(([, v]) => v).map(([k]) => k);

  const card = "rounded-xl border border-border bg-surface p-4";

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/payroll" className="text-sm text-muted hover:text-foreground">← All payroll runs</Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {formatDate(run.period_start)} – {formatDate(run.period_end)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pay date {formatDate(run.pay_date)}{run.label ? ` · ${run.label}` : ""} ·{" "}
            <span className={draft ? "text-warning" : "text-success"}>
              {draft ? "Draft: review before finalizing" : `Finalized ${run.finalized_at ? formatDateTime(run.finalized_at) : ""}`}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <a href={`/payroll/${id}/export`} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground">Download CSV</a>
          {draft && (
            <>
              <ConfirmButton
                action={deleteRun} fields={{ id }} label="Delete draft" pendingLabel="Deleting…"
                confirmText="Delete this draft run? You can create it again afterwards."
                className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/10"
              />
              <ConfirmButton
                action={finalizeRun} fields={{ id }} label="Finalize run" pendingLabel="Finalizing…"
                confirmText="Finalize this run? Payslips become visible to employees and the run can no longer be edited."
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
              />
            </>
          )}
          {!draft && (me.role === "admin" || me.role === "owner") && (
            <ConfirmButton
              action={reopenRun} fields={{ id }} label="Reopen run" pendingLabel="Reopening…"
              confirmText="Reopen this run? Employees will stop seeing these payslips until it is finalized again."
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}><p className="text-xs text-muted">Gross pay</p><p className="mt-1 text-xl font-semibold">{formatPeso(sum((s) => Number(s.gross_pay)))}</p></div>
        <div className={card}><p className="text-xs text-muted">Deductions</p><p className="mt-1 text-xl font-semibold">{formatPeso(sum((s) => Number(s.total_deductions)))}</p></div>
        <div className={card}><p className="text-xs text-muted">Net pay (to release)</p><p className="mt-1 text-xl font-semibold text-accent">{formatPeso(sum((s) => Number(s.net_pay)))}</p></div>
        <div className={card}><p className="text-xs text-muted">Employer contributions</p><p className="mt-1 text-xl font-semibold">{formatPeso(employerCost)}</p></div>
      </div>

      <p className="text-xs text-muted">
        Included: {on.length ? on.join(", ") : "no automatic deductions"}. Rates used: {run.rates_version ?? "unknown"}.
        Confirm the government rates with your accountant.
      </p>

      {missing.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Not included (active, but no payslip): {missing.map((m) => m.full_name).join(", ")}. Most likely no salary is set,
          or they were hired after the period. Set a salary, then delete this draft and create it again.
        </div>
      )}

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 text-right font-medium">Gross</th>
              <th className="px-5 py-3 text-right font-medium">Deductions</th>
              <th className="px-5 py-3 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {slips.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                <td className="px-5 py-3">
                  <Link href={`/payroll/${id}/${s.id}`} className="text-accent hover:underline">{s.employees?.full_name}</Link>
                  <span className="ml-2 text-xs text-muted">{s.employees?.employee_no}</span>
                </td>
                <td className="px-5 py-3 text-right">{formatPeso(s.gross_pay)}</td>
                <td className="px-5 py-3 text-right">{formatPeso(s.total_deductions)}</td>
                <td className="px-5 py-3 text-right font-medium">{formatPeso(s.net_pay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
