import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { manilaToday, formatDate } from "@/lib/format";
import { leaveStatusColor, type LeaveStatus } from "@/lib/leave";
import { cn } from "@/lib/cn";
import { OvertimeForm } from "./OvertimeForm";
import { CancelButton } from "./CancelButton";

type Req = { id: string; work_date: string; hours: number; reason: string | null; status: LeaveStatus; decision_note: string | null };

export default async function OvertimePage() {
  const me = await getCurrentUser();
  if (!me) return null;
  if (!me.employee) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Overtime</h1>
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Your login isn&apos;t linked to an employee record, so you can&apos;t request overtime. Ask an admin or HR.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("overtime_requests")
    .select("id, work_date, hours, reason, status, decision_note")
    .eq("employee_id", me.employee.id)
    .order("work_date", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Req[];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Overtime</h1>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold">Request overtime</h2>
        <OvertimeForm today={manilaToday()} />
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">My requests</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Hours</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Note</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="px-5 py-3 whitespace-nowrap">{formatDate(r.work_date)}</td>
                <td className="px-5 py-3">{Number(r.hours)}</td>
                <td className="px-5 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", leaveStatusColor[r.status])}>{r.status.toLowerCase()}</span>
                </td>
                <td className="px-5 py-3 text-muted">{r.decision_note ?? r.reason ?? "—"}</td>
                <td className="px-5 py-3 text-right">{r.status === "PENDING" && <CancelButton id={r.id} />}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">No overtime requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
