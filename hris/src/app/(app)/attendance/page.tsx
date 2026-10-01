import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/format";

export default async function MyAttendancePage() {
  const me = await getCurrentUser();
  const supabase = await createClient();

  const { data: logs } = me?.employee
    ? await supabase
        .from("attendance_logs")
        .select("id, work_date, time_in, time_out, late_minutes, undertime_minutes")
        .eq("employee_id", me.employee.id)
        .order("work_date", { ascending: false })
        .limit(60)
    : { data: [] };

  return (
    <div>
      <h1 className="text-2xl font-semibold">My Attendance</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">In</th>
              <th className="px-4 py-3 font-medium">Out</th>
              <th className="px-4 py-3 font-medium">Late (min)</th>
              <th className="px-4 py-3 font-medium">Undertime (min)</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{formatDate(l.work_date)}</td>
                <td className="px-4 py-3">{formatTime(l.time_in)}</td>
                <td className="px-4 py-3">{formatTime(l.time_out)}</td>
                <td className="px-4 py-3">{l.late_minutes}</td>
                <td className="px-4 py-3">{l.undertime_minutes}</td>
              </tr>
            ))}
            {!logs?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No attendance records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
