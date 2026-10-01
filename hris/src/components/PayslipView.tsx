import { formatPeso, formatDate } from "@/lib/format";
import { ConfirmButton } from "./ConfirmButton";
import { deleteLine } from "@/app/(app)/payroll/actions";
import { AddLineForm } from "@/app/(app)/payroll/[id]/[slipId]/AddLineForm";
import { PriorBasicForm } from "@/app/(app)/payroll/[id]/[slipId]/PriorBasicForm";

export type SlipLine = { id: string; kind: "EARNING" | "DEDUCTION" | "EMPLOYER"; code: string; label: string; amount: number; is_manual: boolean; sort_order: number };

type Props = {
  employee: { full_name: string; employee_no: string };
  run: { period_start: string; period_end: string; pay_date: string; label: string | null; kind?: string };
  slip: { id: string; gross_pay: number; total_deductions: number; net_pay: number; snapshot: Record<string, number | string> | null };
  lines: SlipLine[];
  canEdit: boolean;      // staff on a DRAFT run
  showEmployer: boolean; // employer cost is for staff only
};

function Table({ title, rows, canEdit }: { title: string; rows: SlipLine[]; canEdit: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-border last:border-0">
              <td className="px-5 py-2.5">
                {l.label}
                {l.is_manual && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">manual</span>}
              </td>
              <td className="px-5 py-2.5 text-right">{formatPeso(l.amount)}</td>
              {canEdit && (
                <td className="w-16 px-3 py-2.5 text-right print:hidden">
                  <ConfirmButton
                    action={deleteLine} fields={{ id: l.id }} label="Remove" pendingLabel="…"
                    confirmText={`Remove "${l.label}" from this payslip?`}
                    className="text-xs text-danger hover:underline"
                  />
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr><td className="px-5 py-3 text-muted" colSpan={3}>None</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export function PayslipView({ employee, run, slip, lines, canEdit, showEmployer }: Props) {
  const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  const s = slip.snapshot ?? {};
  const thirteenth = run.kind === "THIRTEENTH_MONTH";
  const peso = (v: string | number | undefined) => (v === undefined ? undefined : formatPeso(Number(v)));
  const facts: [string, string | number | undefined][] = thirteenth
    ? [
        ["Basic salary paid", peso(s.basic_pay)], ["Less absences", peso(s.absence_deduction)],
        ["Less late / undertime", peso(s.late_deduction)], ["Basic salary earned", peso(s.basic_earned)],
        ["Payroll runs counted", s.runs_counted],
        ["Payroll covered", s.first_period && s.last_period ? `${formatDate(String(s.first_period))} – ${formatDate(String(s.last_period))}` : undefined],
      ]
    : [
        ["Scheduled days", s.days_scheduled], ["Days present", s.days_present],
        ["Paid leave days", s.paid_leave_days], ["Absent days", s.absent_days],
        ["Late (min)", s.late_minutes], ["Undertime (min)", s.undertime_minutes],
      ];

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{employee.full_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {employee.employee_no} ·{" "}
          {thirteenth ? `13th month pay ${run.period_end.slice(0, 4)}` : `${formatDate(run.period_start)} to ${formatDate(run.period_end)}`}
          {" "}· paid {formatDate(run.pay_date)}{run.label && !thirteenth ? ` · ${run.label}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Gross pay</p>
          <p className="mt-1 text-xl font-semibold">{formatPeso(slip.gross_pay)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Deductions</p>
          <p className="mt-1 text-xl font-semibold">{formatPeso(slip.total_deductions)}</p>
        </div>
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-xs text-muted">Net pay</p>
          <p className="mt-1 text-xl font-semibold text-accent">{formatPeso(slip.net_pay)}</p>
        </div>
      </div>

      <Table title="Earnings" rows={sorted.filter((l) => l.kind === "EARNING")} canEdit={canEdit} />
      {!thirteenth && (
        <Table title="Deductions" rows={sorted.filter((l) => l.kind === "DEDUCTION")} canEdit={canEdit} />
      )}
      {showEmployer && !thirteenth && (
        <Table title="Employer contributions (not deducted from pay)" rows={sorted.filter((l) => l.kind === "EMPLOYER")} canEdit={canEdit} />
      )}

      {canEdit && thirteenth && (
        <section className="rounded-xl border border-border bg-surface p-5 print:hidden">
          <h2 className="mb-1 text-sm font-semibold">Basic pay earned outside this system</h2>
          <p className="mb-3 text-xs text-muted">
            For example, salary paid before the HRIS was set up. Enter the total basic pay and one twelfth is added.
          </p>
          <PriorBasicForm payslipId={slip.id} />
        </section>
      )}
      {canEdit && (
        <section className="rounded-xl border border-border bg-surface p-5 print:hidden">
          <h2 className="mb-3 text-sm font-semibold">Add an adjustment</h2>
          <AddLineForm payslipId={slip.id} />
        </section>
      )}
      {thirteenth && (
        <p className="text-xs text-muted">
          13th month pay and other benefits are exempt from income tax up to ₱90,000 combined. Nothing is withheld here.
          {Number(s.taxable_excess ?? 0) > 0 && " This amount is above that limit, so part of it is taxable. Check with your accountant."}
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">{thirteenth ? "How this was calculated" : "Attendance this period"}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
