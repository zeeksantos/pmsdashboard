import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { formatDate, formatPeso, manilaToday } from "@/lib/format";
import { suggestPeriod } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { NewRunForm } from "./NewRunForm";

type Run = {
  id: string; label: string | null; period_start: string; period_end: string; pay_date: string;
  status: "DRAFT" | "FINALIZED"; payslips: { net_pay: number }[];
};

export default async function PayrollPage() {
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll_runs")
    .select("id, label, period_start, period_end, pay_date, status, payslips(net_pay)")
    .order("period_end", { ascending: false });
  const runs = (data ?? []) as unknown as Run[];
  const suggested = suggestPeriod(manilaToday());

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Payroll</h1>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold">New payroll run</h2>
        <NewRunForm start={suggested.start} end={suggested.end} />
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">Runs</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-5 py-3 font-medium">Pay date</th>
              <th className="px-5 py-3 font-medium">Employees</th>
              <th className="px-5 py-3 text-right font-medium">Total net</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                <td className="px-5 py-3">
                  <Link href={`/payroll/${r.id}`} className="text-accent hover:underline">
                    {formatDate(r.period_start)} – {formatDate(r.period_end)}
                  </Link>
                  {r.label && <span className="ml-2 text-xs text-muted">{r.label}</span>}
                </td>
                <td className="px-5 py-3">{formatDate(r.pay_date)}</td>
                <td className="px-5 py-3">{r.payslips.length}</td>
                <td className="px-5 py-3 text-right">{formatPeso(r.payslips.reduce((s, p) => s + Number(p.net_pay), 0))}</td>
                <td className="px-5 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", r.status === "FINALIZED" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {r.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
            {!runs.length && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">No payroll runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
