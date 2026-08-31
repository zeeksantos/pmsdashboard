import Link from "next/link";
import { AlertTriangle, Wallet, LogIn, LogOut, Sparkles, CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate, formatManilaDateTime } from "@/lib/format";
import { getManilaToday, hoursAgoIso } from "@/lib/calendar";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const today = getManilaToday();
  const twoDaysAgo = hoursAgoIso(48);

  const [{ data: bookings }, { data: units }, { data: guests }, { data: housekeepingTasks }, { data: urgentTickets }] =
    await Promise.all([
      supabase.from("bookings").select("*").neq("status", "CANCELLED"),
      supabase.from("units").select("id, name"),
      supabase.from("guests").select("id, full_name"),
      supabase
        .from("housekeeping_tasks")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at", { ascending: true }),
      supabase
        .from("maintenance_tickets")
        .select("*")
        .eq("priority", "URGENT")
        .in("status", ["OPEN", "IN_PROGRESS"])
        .order("created_at", { ascending: true }),
    ]);

  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));
  const guestNameById = new Map((guests ?? []).map((g) => [g.id, g.full_name]));

  const allBookings = bookings ?? [];
  const bookingIds = allBookings.map((b) => b.id);
  const { data: payments } =
    bookingIds.length > 0
      ? await supabase.from("payments").select("booking_id, amount").in("booking_id", bookingIds)
      : { data: [] as { booking_id: string; amount: number }[] };

  const paidByBooking = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + p.amount);
  }

  const paymentsDue = allBookings
    .filter((b) => ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(b.status) && b.check_in <= today)
    .map((b) => ({ booking: b, balance: b.total_amount - (paidByBooking.get(b.id) ?? 0) }))
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const arrivalsToday = allBookings
    .filter((b) => b.check_in === today && ["PENDING", "CONFIRMED"].includes(b.status))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const departuresToday = allBookings
    .filter((b) => b.check_out === today && b.status === "CHECKED_IN")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const recentBookings = allBookings
    .filter((b) => b.created_at >= twoDaysAgo)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  const hasAnything =
    (urgentTickets?.length ?? 0) > 0 ||
    paymentsDue.length > 0 ||
    arrivalsToday.length > 0 ||
    departuresToday.length > 0 ||
    (housekeepingTasks?.length ?? 0) > 0 ||
    recentBookings.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
      <p className="mt-1 text-sm text-muted">
        A live feed pulled from real records across every module — nothing here is hardcoded.
      </p>

      {!hasAnything && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          All caught up — nothing needs attention right now.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8">
        <Section
          title="Urgent Maintenance"
          icon={<AlertTriangle className="h-4 w-4 text-danger" />}
          items={(urgentTickets ?? []).map((t) => ({
            key: t.id,
            href: "/maintenance",
            primary: t.title,
            secondary: `${unitNameById.get(t.unit_id) ?? "—"} · reported ${formatManilaDateTime(t.created_at)}`,
            tone: "danger" as const,
          }))}
        />

        <Section
          title="Payments Due"
          icon={<Wallet className="h-4 w-4 text-warning" />}
          items={paymentsDue.map(({ booking, balance }) => ({
            key: booking.id,
            href: `/billing/${booking.id}`,
            primary: guestNameById.get(booking.guest_id) ?? "Guest",
            secondary: `${unitNameById.get(booking.unit_id) ?? "—"} · ${formatPeso(balance)} outstanding`,
            tone: "warning" as const,
          }))}
        />

        <Section
          title="Arrivals Today"
          icon={<LogIn className="h-4 w-4 text-accent" />}
          items={arrivalsToday.map((b) => ({
            key: b.id,
            href: "/check-in-out",
            primary: guestNameById.get(b.guest_id) ?? "Guest",
            secondary: `${unitNameById.get(b.unit_id) ?? "—"} · check-in ${formatManilaDate(b.check_in)}`,
            tone: "accent" as const,
          }))}
        />

        <Section
          title="Departures Today"
          icon={<LogOut className="h-4 w-4 text-accent" />}
          items={departuresToday.map((b) => ({
            key: b.id,
            href: "/check-in-out",
            primary: guestNameById.get(b.guest_id) ?? "Guest",
            secondary: `${unitNameById.get(b.unit_id) ?? "—"} · check-out ${formatManilaDate(b.check_out)}`,
            tone: "accent" as const,
          }))}
        />

        <Section
          title="Housekeeping Needed"
          icon={<Sparkles className="h-4 w-4 text-warning" />}
          items={(housekeepingTasks ?? []).map((t) => ({
            key: t.id,
            href: "/housekeeping",
            primary: unitNameById.get(t.unit_id) ?? "Unit",
            secondary: `Task created ${formatManilaDateTime(t.created_at)}`,
            tone: "warning" as const,
          }))}
        />

        <Section
          title="Recent Bookings"
          icon={<CalendarPlus className="h-4 w-4 text-muted" />}
          items={recentBookings.map((b) => ({
            key: b.id,
            href: "/bookings",
            primary: guestNameById.get(b.guest_id) ?? "Guest",
            secondary: `${unitNameById.get(b.unit_id) ?? "—"} · created ${formatManilaDateTime(b.created_at)}`,
            tone: "muted" as const,
          }))}
        />
      </div>
    </div>
  );
}

interface FeedItem {
  key: string;
  href: string;
  primary: string;
  secondary: string;
  tone: "danger" | "warning" | "accent" | "muted";
}

function Section({ title, icon, items }: { title: string; icon: React.ReactNode; items: FeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        {icon}
        {title}
        <span className="text-sm font-normal text-muted">({items.length})</span>
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 hover:border-accent/50"
          >
            <div>
              <div className="text-sm font-medium text-foreground">{item.primary}</div>
              <div className="text-xs text-muted">{item.secondary}</div>
            </div>
            <ToneDot tone={item.tone} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function ToneDot({ tone }: { tone: FeedItem["tone"] }) {
  const toneClass = {
    danger: "bg-danger",
    warning: "bg-warning",
    accent: "bg-accent",
    muted: "bg-muted",
  }[tone];
  return <span className={`h-2 w-2 shrink-0 rounded-full ${toneClass}`} />;
}
