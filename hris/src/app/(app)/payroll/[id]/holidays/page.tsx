import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { formatDate, formatPeso } from "@/lib/format";
import { HOLIDAY_CODES, holidayCodeLabels } from "@/lib/holiday-report";
import { companyKindLabels } from "@/lib/company-events";
import { PrintButton } from "@/components/PrintButton";
import { loadHolidayReport } from "./data";

const card = "rounded-xl border border-border bg-surface p-4";

export default async function HolidayPaySummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) notFound();
  const report = await loadHolidayReport(id);
  if (!report) notFound();
  const { run, holidays, summary } = report;
  const { rows, totals } = summary;
  const days = (n: number) => (n === 0 ? "–" : String(n));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/payroll/${id}`} className="text-sm text-muted hover:text-foreground print:hidden">← Back to the payroll run</Link>
          <h1 className="mt-2 text-2xl font-semibold">Holiday pay summary</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(run.period_start)} – {formatDate(run.period_end)}
            {run.label ? ` · ${run.label}` : ""} · {run.status === "DRAFT" ? "Draft" : "Finalized"}
          </p>
        </div>
        <div className="flex gap-3 print:hidden">
          <a href={`/payroll/${id}/holidays/csv`} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground">Download CSV</a>
          <PrintButton />
        </div>
      </div>

      <section className={card}>
        <h2 className="text-sm font-semibold">Holidays in this pay period</h2>
        {holidays.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No holidays fall in this period, so there is no holiday pay.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {holidays.map((h) => (
              <li key={`${h.title}-${h.start_date}`} className="flex flex-wrap justify-between gap-3">
                <span>{h.title}</span>
                <span className="text-muted">
                  {formatDate(h.start_date)} · {companyKindLabels[h.kind]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!summary.included ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          This run was created without the Holiday pay option, so its payslips have no holiday pay.
          {run.status === "DRAFT"
            ? " Delete the draft and create it again with Holiday pay ticked."
            : " Reopen the run (Admin or Owner), delete it and create it again with Holiday pay ticked, or add holiday lines by hand."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={card}>
              <p className="text-xs text-muted">Holiday premium pay</p>
              <p className="mt-1 text-xl font-semibold text-accent">{formatPeso(totals.total)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted">Employees with holiday activity</p>
              <p className="mt-1 text-xl font-semibold">{rows.length}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted">Unworked regular holidays paid</p>
              <p className="mt-1 text-xl font-semibold">{totals.paidUnworked}</p>
              <p className="mt-0.5 text-xs text-muted">Already inside basic pay; not counted as absences</p>
            </div>
          </div>

          <section className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Holiday pay type</th>
                  <th className="px-5 py-3 text-right font-medium">Days</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {HOLIDAY_CODES.map((c) => (
                  <tr key={c} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">{holidayCodeLabels[c]}</td>
                    <td className="px-5 py-3 text-right">{days(totals.days[c])}</td>
                    <td className="px-5 py-3 text-right">{formatPeso(totals.amounts[c])}</td>
                  </tr>
                ))}
                <tr className="bg-surface-raised font-medium">
                  <td className="px-5 py-3">Total holiday premium</td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-right">{formatPeso(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 text-right font-medium">Regular worked</th>
                  <th className="px-3 py-3 text-right font-medium">Special worked</th>
                  <th className="px-3 py-3 text-right font-medium">Rest day worked</th>
                  <th className="px-3 py-3 text-right font-medium">Paid, not worked</th>
                  <th className="px-5 py-3 text-right font-medium">Premium pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee_id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      {r.name}
                      <span className="ml-2 text-xs text-muted">{r.employee_no}</span>
                    </td>
                    <td className="px-3 py-3 text-right">{days(r.days.HOLIDAY_REG)}</td>
                    <td className="px-3 py-3 text-right">{days(r.days.HOLIDAY_SPECIAL)}</td>
                    <td className="px-3 py-3 text-right">{days(r.days.HOLIDAY_REG_REST + r.days.HOLIDAY_SPECIAL_REST)}</td>
                    <td className="px-3 py-3 text-right">{days(r.paidUnworked)}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatPeso(r.total)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-muted">
                      Nobody worked a holiday or earned paid-holiday pay in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      <p className="text-xs text-muted">
        Standard DOLE holiday rules; have your accountant confirm them. Premium pay is part of gross pay and taxable, and is
        not counted in the 13th month pay. Overtime and night differential are not included.
      </p>
    </div>
  );
}
