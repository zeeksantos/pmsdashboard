import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate } from "@/lib/format";
import { BOOKING_STATUS_STYLES } from "@/lib/status-colors";
import { StatusBadge } from "@/components/StatusBadge";

export default async function BillingPage() {
  const supabase = await createClient();

  const [{ data: bookings, error }, { data: units }, { data: guests }] = await Promise.all([
    supabase.from("bookings").select("*").neq("status", "CANCELLED"),
    supabase.from("units").select("id, name"),
    supabase.from("guests").select("id, full_name"),
  ]);

  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));
  const guestById = new Map((guests ?? []).map((g) => [g.id, g]));

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const { data: payments } =
    bookingIds.length > 0
      ? await supabase.from("payments").select("booking_id, amount").in("booking_id", bookingIds)
      : { data: [] as { booking_id: string; amount: number }[] };

  const paidByBooking = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + p.amount);
  }

  const rows = (bookings ?? [])
    .map((booking) => {
      const paid = paidByBooking.get(booking.id) ?? 0;
      return { booking, paid, balance: booking.total_amount - paid };
    })
    .sort((a, b) => b.balance - a.balance);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Billing & Payments</h1>
      <p className="mt-1 text-sm text-muted">
        Itemized bills per booking with a running balance — highest balance due shown first.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load bookings: {error.message}
        </div>
      )}

      {!error && rows.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No bookings yet.
        </div>
      )}

      {!error && rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking, paid, balance }) => {
                const guest = guestById.get(booking.guest_id);
                return (
                  <tr key={booking.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {guest ? (
                        <Link href={`/guests/${guest.id}`} className="hover:text-accent hover:underline">
                          {guest.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{unitNameById.get(booking.unit_id) ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatManilaDate(booking.check_in)} – {formatManilaDate(booking.check_out)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={booking.status} className={BOOKING_STATUS_STYLES[booking.status]} />
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{formatPeso(booking.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatPeso(paid)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        balance > 0 ? "text-danger" : balance < 0 ? "text-success" : "text-muted"
                      }`}
                    >
                      {formatPeso(balance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/billing/${booking.id}`}
                        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
