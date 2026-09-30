import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";
import { manilaToday } from "@/lib/format";
import { formatDays, formatRange, leaveStatusColor, type LeaveBalance, type LeaveStatus } from "@/lib/leave";
import { cn } from "@/lib/cn";
import { LeaveForm } from "./LeaveForm";
import { CancelButton } from "./CancelButton";

type Req = {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  reason: string | null;
  status: LeaveStatus;
  decision_note: string | null;
  leave_types: { name: string } | null;
};

export default async function LeavePage() {
  const me = await getCurrentUser();
  if (!me) return null;

  if (!me.employee) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Your login isn&apos;t linked to an employee record, so you can&apos;t request leave. Ask an admin or HR.
        </p>
      </div>
    );
  }

  const today = manilaToday();
  const year = Number(today.slice(0, 4));
  const supabase = await createClient();

  const [{ data: balances }, { data: requests }, { data: types }] = await Promise.all([
    supabase.rpc("leave_balances", { p_employee: me.employee.id, p_year: year }),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, days, half_day, reason, status, decision_note, leave_types(name)")
      .eq("employee_id", me.employee.id)
      .order("start_date", { ascending: false })
      .limit(50),
    supabase.from("leave_types").select("id, name").eq("active", true).order("name"),
  ]);
  const rows = (requests ?? []) as unknown as Req[];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Leave</h1>
        {canManageRecords(me.role) && (
          <Link href="/leave/settings" className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground">
            Leave settings
          </Link>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">Your {year} balance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {((balances ?? []) as LeaveBalance[]).map((b) => (
            <div key={b.leave_type_id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-muted">{b.name}</p>
              {b.has_balance ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">{Number(b.remaining)} <span className="text-sm font-normal text-muted">left</span></p>
                  <p className="mt-1 text-xs text-muted">
                    {Number(b.allowance)} allowed · {Number(b.used)} used · {Number(b.pending)} pending
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold">{Number(b.used)} <span className="text-sm font-normal text-muted">used</span></p>
                  <p className="mt-1 text-xs text-muted">No limit{b.is_paid ? "" : " · unpaid"}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold">Request leave</h2>
        <LeaveForm types={types ?? []} today={today} />
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">My requests</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Dates</th>
              <th className="px-5 py-3 font-medium">Days</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Note</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="px-5 py-3">{r.leave_types?.name}</td>
                <td className="px-5 py-3 whitespace-nowrap">{formatRange(r.start_date, r.end_date)}{r.half_day && " (half)"}</td>
                <td className="px-5 py-3">{formatDays(r.days)}</td>
                <td className="px-5 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", leaveStatusColor[r.status])}>{r.status.toLowerCase()}</span>
                </td>
                <td className="px-5 py-3 text-muted">{r.decision_note ?? r.reason ?? "—"}</td>
                <td className="px-5 py-3 text-right">
                  {(r.status === "PENDING" || (r.status === "APPROVED" && r.start_date >= today)) && <CancelButton id={r.id} />}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-muted">No leave requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
