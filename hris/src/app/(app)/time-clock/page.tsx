import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { formatDate, manilaToday } from "@/lib/format";
import { ClockPanel } from "./ClockPanel";

export default async function TimeClockPage() {
  const me = await getCurrentUser();
  const today = manilaToday();

  let log: { time_in: string | null; time_out: string | null; late_minutes: number; work_mode: string; field_note: string | null } | null = null;
  if (me?.employee) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("attendance_logs")
      .select("time_in, time_out, late_minutes, work_mode, field_note")
      .eq("employee_id", me.employee.id)
      .eq("work_date", today)
      .maybeSingle();
    log = data;
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold">Time Clock</h1>
      <p className="mt-1 text-sm text-muted">{formatDate(today)}</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        {me?.employee ? (
          <ClockPanel log={log} />
        ) : (
          <p className="text-sm text-warning">
            Your login isn&apos;t linked to an employee record. Ask an admin or HR.
          </p>
        )}
      </div>
    </div>
  );
}
