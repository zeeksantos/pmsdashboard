import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewTeamAttendance } from "@/lib/roles";
import { manilaToday } from "@/lib/format";
import { formatDays, formatRange, leaveStatusColor, type LeaveBalance, type LeaveStatus } from "@/lib/leave";
import { cn } from "@/lib/cn";
import { DecisionForm } from "./DecisionForm";

type Req = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  reason: string | null;
  status: LeaveStatus;
  requested_at: string;
  decision_note: string | null;
  employees: { full_name: string } | null;
  leave_types: { name: string } | null;
};

const select =
  "id, employee_id, leave_type_id, start_date, end_date, days, half_day, reason, status, requested_at, decision_note, employees(full_name), leave_types(name)";

export default async function ApprovalsPage() {
  const me = await getCurrentUser();
  if (!me || !canViewTeamAttendance(me.role)) notFound();

  const supabase = await createClient();
  const year = Number(manilaToday().slice(0, 4));

  // The database decides which requests appear: your direct reports', or everyone's for HR/admin/owner.
  // Your own requests are decided by someone else, so they don't belong in your queue.
  let pendingQuery = supabase.from("leave_requests").select(select).eq("status", "PENDING").order("requested_at");
  if (me.employee) pendingQuery = pendingQuery.neq("employee_id", me.employee.id);
  const [{ data: pending }, { data: decided }] = await Promise.all([
    pendingQuery,
    supabase.from("leave_requests").select(select).neq("status", "PENDING").order("requested_at", { ascending: false }).limit(30),
  ]);
  const pendingRows = (pending ?? []) as unknown as Req[];
  const history = (decided ?? []) as unknown as Req[];

  // Remaining balance per employee, so the approver sees what they're approving against.
  const balances = new Map<string, LeaveBalance[]>();
  await Promise.all(
    [...new Set(pendingRows.map((r) => r.employee_id))].map(async (id) => {
      const { data } = await supabase.rpc("leave_balances", { p_employee: id, p_year: year });
      balances.set(id, (data ?? []) as LeaveBalance[]);
    })
  );

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave Approvals</h1>
        <p className="mt-1 text-sm text-muted">
          {me.role === "manager"
            ? "Requests from people who report to you."
            : "Requests from everyone. Managers approve their own reports; HR, admin and owner can approve any."}
        </p>
      </div>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">Waiting for a decision ({pendingRows.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Dates</th>
              <th className="px-5 py-3 font-medium">Days</th>
              <th className="px-5 py-3 font-medium">Balance</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pendingRows.map((r) => {
              const b = balances.get(r.employee_id)?.find((x) => x.leave_type_id === r.leave_type_id);
              return (
                <tr key={r.id} className="border-b border-border align-top last:border-0">
                  <td className="px-5 py-3">{r.employees?.full_name}</td>
                  <td className="px-5 py-3">{r.leave_types?.name}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{formatRange(r.start_date, r.end_date)}{r.half_day && " (half)"}</td>
                  <td className="px-5 py-3">{formatDays(r.days)}</td>
                  <td className="px-5 py-3 text-muted">
                    {b ? (b.has_balance ? `${Number(b.remaining) + Number(r.days)} available` : "No limit") : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{r.reason ?? "—"}</td>
                  <td className="px-5 py-3"><DecisionForm id={r.id} /></td>
                </tr>
              );
            })}
            {!pendingRows.length && (
              <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">Nothing waiting.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">Recent decisions</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {history.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">{r.employees?.full_name}</td>
                <td className="px-5 py-3">{r.leave_types?.name}</td>
                <td className="px-5 py-3 whitespace-nowrap">{formatRange(r.start_date, r.end_date)}</td>
                <td className="px-5 py-3">{formatDays(r.days)}</td>
                <td className="px-5 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", leaveStatusColor[r.status])}>{r.status.toLowerCase()}</span>
                </td>
                <td className="px-5 py-3 text-muted">{r.decision_note ?? ""}</td>
              </tr>
            ))}
            {!history.length && (
              <tr><td className="px-5 py-6 text-center text-muted">No decisions yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
