import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getManilaToday,
  getRange,
  shiftDate,
  formatDayLabel,
  formatRangeLabel,
  type CalendarView,
} from "@/lib/calendar";
import { BOOKING_STATUS_STYLES } from "@/lib/status-colors";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const view: CalendarView = params.view === "day" || params.view === "month" ? params.view : "week";
  const today = getManilaToday();
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  const { start, end, days } = getRange(view, date);

  const supabase = await createClient();
  const [{ data: units, error }, { data: bookings }] = await Promise.all([
    supabase.from("units").select("id, name").order("name", { ascending: true }),
    supabase
      .from("bookings")
      .select("*")
      .lte("check_in", end)
      .gt("check_out", start)
      .neq("status", "CANCELLED"),
  ]);

  const guestIds = [...new Set((bookings ?? []).map((b) => b.guest_id))];
  const { data: guests } =
    guestIds.length > 0
      ? await supabase.from("guests").select("id, full_name").in("id", guestIds)
      : { data: [] as { id: string; full_name: string }[] };
  const guestNameById = new Map((guests ?? []).map((g) => [g.id, g.full_name]));

  const bookingsByUnit = new Map<string, NonNullable<typeof bookings>>();
  for (const b of bookings ?? []) {
    const list = bookingsByUnit.get(b.unit_id) ?? [];
    list.push(b);
    bookingsByUnit.set(b.unit_id, list);
  }

  const prevDate = shiftDate(date, view, -1);
  const nextDate = shiftDate(date, view, 1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
          <p className="mt-1 text-sm text-muted">
            Occupancy across all units, read directly from the same Bookings data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/calendar?view=${v.key}&date=${date}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === v.key
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-raised text-muted hover:text-foreground"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?view=${view}&date=${prevDate}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            ← Prev
          </Link>
          <Link
            href={`/calendar?view=${view}&date=${today}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Today
          </Link>
          <Link
            href={`/calendar?view=${view}&date=${nextDate}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Next →
          </Link>
        </div>
        <div className="text-sm font-medium text-foreground">{formatRangeLabel(start, end)}</div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load units: {error.message}
        </div>
      )}

      {!error && units && units.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No units yet — add one on Units & Rates first.
        </div>
      )}

      {!error && units && units.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="border-collapse text-sm" style={{ minWidth: `${160 + days.length * 96}px` }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 border-b border-r border-border bg-surface px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted"
                  style={{ width: 160 }}
                >
                  Unit
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`border-b border-border px-2 py-3 text-center text-xs font-medium ${
                      d === today ? "bg-accent/10 text-accent" : "text-muted"
                    }`}
                    style={{ width: 96 }}
                  >
                    {formatDayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 border-r border-border bg-surface px-4 py-3 font-medium text-foreground">
                    {unit.name}
                  </td>
                  {days.map((d) => {
                    const booking = (bookingsByUnit.get(unit.id) ?? []).find(
                      (b) => d >= b.check_in && d < b.check_out
                    );
                    return (
                      <td
                        key={d}
                        className={`border-l border-border p-1 text-center ${d === today ? "bg-accent/5" : ""}`}
                      >
                        {booking ? (
                          <Link
                            href="/bookings"
                            title={`${guestNameById.get(booking.guest_id) ?? "Guest"} · ${booking.status}`}
                            className={`block truncate rounded px-1.5 py-1 text-xs font-medium ${BOOKING_STATUS_STYLES[booking.status]}`}
                          >
                            {guestNameById.get(booking.guest_id) ?? "Guest"}
                          </Link>
                        ) : (
                          <span className="text-muted/30">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
