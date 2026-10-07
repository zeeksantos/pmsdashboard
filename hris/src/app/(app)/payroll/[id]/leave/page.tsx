import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { formatDate, formatPeso } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { loadLeaveReport } from "./data";

const card = "rounded-xl border border-border bg-surface p-4";

export default async function LeavePaySummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) notFound();
  const report = await loadLeaveReport(id);
  if (!report) notFound();
  const { run, deductAbsences, summary } = report;
  const { rows, totals, byType, mismatched } = summary;
  const days = (n: number) => (n === 0 ? "–" : String(n));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/payroll/${id}`} className="text-sm text-muted hover:text-foreground print:hidden">← Back to the payroll run</Link>
          <h1 className="mt-2 text-2xl font-semibold">Leave pay summary</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(run.period_start)} – {formatDate(run.period_end)}
            {run.label ? ` · ${run.label}` : ""} · {run.status === "DRAFT" ? "Draft" : "Finalized"}
          </p>
        </div>
        <div className="flex gap-3 print:hidden">
          <a href={`/payroll/${id}/leave/csv`} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground">Download CSV</a>
          <PrintButton />
        </div>
      </div>

      {mismatched.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Leave has changed since the payslips were calculated for: {mismatched.join(", ")}. This report shows approved leave as it
          is now, but their payslips still use the old numbers.
          {run.status === "DRAFT" ? " Delete the draft and create it again to refresh them." : " Reopen the run (Admin or Owner) to recalculate."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-muted">Paid leave days</p>
          <p className="mt-1 text-xl font-semibold">{totals.paidDays}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted">Paid leave pay</p>
          <p className="mt-1 text-xl font-semibold text-accent">{formatPeso(totals.paidValue)}</p>
          <p className="mt-0.5 text-xs text-muted">Already inside basic pay</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted">Unpaid leave days</p>
          <p className="mt-1 text-xl font-semibold">{totals.unpaidDays}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted">Pay withheld for unpaid leave</p>
          <p className="mt-1 text-xl font-semibold">{formatPeso(totals.unpaidValue)}</p>
        </div>
      </div>

      {!deductAbsences && totals.unpaidDays > 0 && (
        <p className="text-xs text-muted">
          This run was created without Deduct absences, so unpaid leave of monthly staff was not taken out of their pay (shown as ₱0.00).
        </p>
      )}

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Leave type</th>
              <th className="px-3 py-3 font-medium">Paid?</th>
              <th className="px-3 py-3 text-right font-medium">Employees</th>
              <th className="px-3 py-3 text-right font-medium">Days</th>
              <th className="px-5 py-3 text-right font-medium">Pay value</th>
            </tr>
          </thead>
          <tbody>
            {byType.map((t) => (
              <tr key={`${t.is_paid}-${t.leave_type}`} className="border-b border-border last:border-0">
                <td className="px-5 py-3">{t.leave_type}</td>
                <td className="px-3 py-3">{t.is_paid ? "Paid" : "Unpaid"}</td>
                <td className="px-3 py-3 text-right">{t.employees}</td>
                <td className="px-3 py-3 text-right">{t.days}</td>
                <td className="px-5 py-3 text-right">{formatPeso(t.value)}</td>
              </tr>
            ))}
            {byType.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">No approved leave falls on a working day in this period.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-3 py-3 font-medium">Leave</th>
              <th className="px-3 py-3 text-right font-medium">Paid days</th>
              <th className="px-3 py-3 text-right font-medium">Paid pay</th>
              <th className="px-3 py-3 text-right font-medium">Unpaid days</th>
              <th className="px-5 py-3 text-right font-medium">Pay withheld</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee_id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  {r.name}
                  <span className="ml-2 text-xs text-muted">{r.employee_no}</span>
                </td>
                <td className="px-3 py-3 text-muted">{r.types.map((t) => `${t.leave_type} ${t.days}`).join(", ")}</td>
                <td className="px-3 py-3 text-right">{days(r.paidDays)}</td>
                <td className="px-3 py-3 text-right">{r.paidDays ? formatPeso(r.paidValue) : "–"}</td>
                <td className="px-3 py-3 text-right">{days(r.unpaidDays)}</td>
                <td className="px-5 py-3 text-right">{r.unpaidDays ? formatPeso(r.unpaidValue) : "–"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-muted">Nobody was on approved leave in this period.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-muted">
        Only approved leave on scheduled working days counts, and not on days the employee timed in. A day&apos;s value is the
        daily rate saved on the payslip. Leave shown is as it stands today, so later changes to leave requests will show here.
      </p>
    </div>
  );
}
