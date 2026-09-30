import { formatPeso, formatDate } from "@/lib/format";
import { ConfirmButton } from "./ConfirmButton";
import { deleteLine } from "@/app/(app)/payroll/actions";
import { AddLineForm } from "@/app/(app)/payroll/[id]/[slipId]/AddLineForm";

export type SlipLine = { id: string; kind: "EARNING" | "DEDUCTION" | "EMPLOYER"; code: string; label: string; amount: number; is_manual: boolean; sort_order: number };

type Props = {
  employee: { full_name: string; employee_no: string };
  run: { period_start: string; period_end: string; pay_date: string; label: string | null };
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
  const facts: [string, string | number | undefined][] = [
    ["Scheduled days", s.days_scheduled], ["Days present", s.days_present],
    ["Paid leave days", s.paid_leave_days], ["Absent days", s.absent_days],
    ["Late (min)", s.late_minutes], ["Undertime (min)", s.undertime_minutes],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{employee.full_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {employee.employee_no} · {formatDate(run.period_start)} to {formatDate(run.period_end)} · paid {formatDate(run.pay_date)}
          {run.label ? ` · ${run.label}` : ""}
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
      <Table title="Deductions" rows={sorted.filter((l) => l.kind === "DEDUCTION")} canEdit={canEdit} />
      {showEmployer && (
        <Table title="Employer contributions (not deducted from pay)" rows={sorted.filter((l) => l.kind === "EMPLOYER")} canEdit={canEdit} />
      )}

      {canEdit && (
        <section className="rounded-xl border border-border bg-surface p-5 print:hidden">
          <h2 className="mb-3 text-sm font-semibold">Add an adjustment</h2>
          <AddLineForm payslipId={slip.id} />
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Attendance this period</h2>
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
