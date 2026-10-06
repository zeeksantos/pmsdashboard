import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewTeamAttendance } from "@/lib/roles";
import { formatDate, formatTime, manilaToday, mapLink } from "@/lib/format";

type Row = {
  id: string;
  time_in: string | null;
  time_out: string | null;
  in_lat: number | null;
  in_lng: number | null;
  out_lat: number | null;
  out_lng: number | null;
  late_minutes: number;
  undertime_minutes: number;
  work_mode: string;
  field_note: string | null;
  employees: { full_name: string } | null;
};

function MapLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  const href = mapLink(lat, lng);
  if (!href) return <span className="text-muted">—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      Map
    </a>
  );
}

export default async function TeamAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me || !canViewTeamAttendance(me.role)) notFound();

  const { date } = await searchParams;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : manilaToday();

  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_logs")
    .select(
      "id, time_in, time_out, in_lat, in_lng, out_lat, out_lng, late_minutes, undertime_minutes, work_mode, field_note, employees(full_name)"
    )
    .eq("work_date", day)
    .order("time_in", { ascending: true });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Team Attendance</h1>
      <form className="mt-2 flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={day}
          className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm"
        />
        <button className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground">
          View
        </button>
        <span className="text-sm text-muted">{formatDate(day)}</span>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Where</th>
              <th className="px-4 py-3 font-medium">In</th>
              <th className="px-4 py-3 font-medium">In location</th>
              <th className="px-4 py-3 font-medium">Out</th>
              <th className="px-4 py-3 font-medium">Out location</th>
              <th className="px-4 py-3 font-medium">Late</th>
              <th className="px-4 py-3 font-medium">Undertime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{r.employees?.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.work_mode === "FIELD" ? (
                    <span>
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Field</span>
                      {r.field_note && <span className="mt-1 block text-xs text-muted">{r.field_note}</span>}
                    </span>
                  ) : (
                    <span className="text-muted">Office</span>
                  )}
                </td>
                <td className="px-4 py-3">{formatTime(r.time_in)}</td>
                <td className="px-4 py-3"><MapLink lat={r.in_lat} lng={r.in_lng} /></td>
                <td className="px-4 py-3">{formatTime(r.time_out)}</td>
                <td className="px-4 py-3"><MapLink lat={r.out_lat} lng={r.out_lng} /></td>
                <td className="px-4 py-3">{r.late_minutes}</td>
                <td className="px-4 py-3">{r.undertime_minutes}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">
                  No attendance for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
