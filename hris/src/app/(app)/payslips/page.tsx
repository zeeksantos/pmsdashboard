import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { formatDate, formatPeso } from "@/lib/format";

type Row = {
  id: string; gross_pay: number; net_pay: number;
  payroll_runs: { period_start: string; period_end: string; pay_date: string } | null;
};

export default async function MyPayslipsPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  if (!me.employee) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">My Payslips</h1>
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Your login isn&apos;t linked to an employee record. Ask an admin or HR.
        </p>
      </div>
    );
  }

  // The database only returns payslips from finalized runs.
  const supabase = await createClient();
  const { data } = await supabase
    .from("payslips")
    .select("id, gross_pay, net_pay, payroll_runs(period_start, period_end, pay_date)")
    .eq("employee_id", me.employee.id);
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    (b.payroll_runs?.period_end ?? "").localeCompare(a.payroll_runs?.period_end ?? ""));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">My Payslips</h1>
      <p className="mt-1 text-sm text-muted">Payslips appear here once payroll for the period is finalized.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-5 py-3 font-medium">Pay date</th>
              <th className="px-5 py-3 text-right font-medium">Net pay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                <td className="px-5 py-3">
                  <Link href={`/payslips/${r.id}`} className="text-accent hover:underline">
                    {r.payroll_runs && `${formatDate(r.payroll_runs.period_start)} – ${formatDate(r.payroll_runs.period_end)}`}
                  </Link>
                </td>
                <td className="px-5 py-3">{r.payroll_runs && formatDate(r.payroll_runs.pay_date)}</td>
                <td className="px-5 py-3 text-right font-medium">{formatPeso(r.net_pay)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={3} className="px-5 py-6 text-center text-muted">No payslips yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
