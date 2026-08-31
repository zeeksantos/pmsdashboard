import { createClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/format";
import { getManilaToday, getLastNDays, toManilaDateString, formatDayLabel } from "@/lib/calendar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = getManilaToday();

  const [{ data: units }, { data: bookings }, { data: maintenanceTickets }] = await Promise.all([
    supabase.from("units").select("id, status"),
    supabase.from("bookings").select("id, status, check_in, check_out, total_amount").neq("status", "CANCELLED"),
    supabase.from("maintenance_tickets").select("id, status"),
  ]);

  const allUnits = units ?? [];
  const allBookings = bookings ?? [];

  const bookingIds = allBookings.map((b) => b.id);
  const { data: payments } =
    bookingIds.length > 0
      ? await supabase.from("payments").select("booking_id, amount, paid_at").in("booking_id", bookingIds)
      : { data: [] as { booking_id: string; amount: number; paid_at: string }[] };
  const allPayments = payments ?? [];

  const paidByBooking = new Map<string, number>();
  for (const p of allPayments) {
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + p.amount);
  }

  // Units
  const totalUnits = allUnits.length;
  const availableCount = allUnits.filter((u) => u.status === "AVAILABLE").length;
  const occupiedCount = allUnits.filter((u) => u.status === "OCCUPIED").length;
  const dirtyCount = allUnits.filter((u) => u.status === "DIRTY").length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;

  // Bookings
  const checkInsToday = allBookings.filter((b) => b.check_in === today).length;
  const checkOutsToday = allBookings.filter((b) => b.check_out === today).length;
  const currentGuests = allBookings.filter((b) => b.status === "CHECKED_IN").length;
  const pendingPaymentsTotal = allBookings.reduce((sum, b) => {
    const balance = b.total_amount - (paidByBooking.get(b.id) ?? 0);
    return sum + Math.max(0, balance);
  }, 0);

  // Payments
  const todaysRevenue = allPayments
    .filter((p) => toManilaDateString(p.paid_at) === today)
    .reduce((sum, p) => sum + p.amount, 0);

  // Maintenance
  const openMaintenanceCount = (maintenanceTickets ?? []).filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status)
  ).length;

  // Weekly revenue trend (last 7 days, Manila calendar days)
  const last7Days = getLastNDays(7, today);
  const revenueByDay = new Map<string, number>();
  for (const day of last7Days) revenueByDay.set(day, 0);
  for (const p of allPayments) {
    const day = toManilaDateString(p.paid_at);
    if (revenueByDay.has(day)) {
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + p.amount);
    }
  }
  const maxDayRevenue = Math.max(1, ...last7Days.map((d) => revenueByDay.get(d) ?? 0));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Every number here is a live query against the same tables the rest of the app uses.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Check-ins Today" value={String(checkInsToday)} />
        <KpiCard label="Check-outs Today" value={String(checkOutsToday)} />
        <KpiCard label="Current Guests" value={String(currentGuests)} />
        <KpiCard label="Available Rooms" value={String(availableCount)} tone="success" />
        <KpiCard label="Occupied Rooms" value={String(occupiedCount)} tone="accent" />
        <KpiCard label="Occupancy Rate" value={`${occupancyRate}%`} />
        <KpiCard label="Today's Revenue" value={formatPeso(todaysRevenue)} tone="success" />
        <KpiCard
          label="Pending Payments"
          value={formatPeso(pendingPaymentsTotal)}
          tone={pendingPaymentsTotal > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Rooms Needing Cleaning"
          value={String(dirtyCount)}
          tone={dirtyCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Open Maintenance"
          value={String(openMaintenanceCount)}
          tone={openMaintenanceCount > 0 ? "danger" : "default"}
        />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Weekly Revenue Trend</h2>
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex justify-between gap-2" style={{ height: 160 }}>
          {last7Days.map((day) => {
            const value = revenueByDay.get(day) ?? 0;
            const heightPct = Math.max(4, Math.round((value / maxDayRevenue) * 100));
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 flex-col justify-end">
                  <div
                    title={formatPeso(value)}
                    className="w-full rounded-t-md bg-accent/70 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted">{formatDayLabel(day)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    accent: "text-accent",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
