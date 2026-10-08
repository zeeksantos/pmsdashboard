import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewTeamAttendance } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { leaveStatusColor, type LeaveStatus } from "@/lib/leave";
import { cn } from "@/lib/cn";
import { DecisionForm } from "./DecisionForm";

type Req = {
  id: string; work_date: string; hours: number; reason: string | null; status: LeaveStatus;
  decision_note: string | null; employees: { full_name: string } | null;
};
const select = "id, work_date, hours, reason, status, decision_note, employees(full_name)";

export default async function OvertimeApprovalsPage() {
  const me = await getCurrentUser();
  if (!me || !canViewTeamAttendance(me.role)) notFound();

  const supabase = await createClient();
  // The database decides which requests appear: your direct reports', or everyone's for HR/admin/owner.
  let pendingQuery = supabase.from("overtime_requests").select(select).eq("status", "PENDING").order("requested_at");
  if (me.employee) pendingQuery = pendingQuery.neq("employee_id", me.employee.id);
  const [{ data: pending }, { data: decided }] = await Promise.all([
    pendingQuery,
    supabase.from("overtime_requests").select(select).neq("status", "PENDING").order("requested_at", { ascending: false }).limit(30),
  ]);
  const pendingRows = (pending ?? []) as unknown as Req[];
  const history = (decided ?? []) as unknown as Req[];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overtime Approvals</h1>
        <p className="mt-1 text-sm text-muted">
          {me.role === "manager"
            ? "Requests from people who report to you."
            : "Requests from everyone. Managers approve their own reports; HR, admin and owner can approve any."}{" "}
          Only approved hours are paid in payroll.
        </p>
      </div>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">Waiting for a decision ({pendingRows.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Hours</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pendingRows.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="px-5 py-3">{r.employees?.full_name}</td>
                <td className="px-5 py-3 whitespace-nowrap">{formatDate(r.work_date)}</td>
                <td className="px-5 py-3">{Number(r.hours)}</td>
                <td className="px-5 py-3 text-muted">{r.reason ?? "—"}</td>
                <td className="px-5 py-3"><DecisionForm id={r.id} /></td>
              </tr>
            ))}
            {!pendingRows.length && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">Nothing waiting.</td></tr>
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
                <td className="px-5 py-3 whitespace-nowrap">{formatDate(r.work_date)}</td>
                <td className="px-5 py-3">{Number(r.hours)} h</td>
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
