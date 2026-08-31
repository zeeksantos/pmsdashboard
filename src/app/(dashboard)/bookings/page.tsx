import Link from "next/link";
import { Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate } from "@/lib/format";
import { BookingFormDialog } from "./BookingFormDialog";
import { BookingStatusSelect } from "./BookingStatusSelect";
import { DeleteBookingButton } from "./DeleteBookingButton";

export default async function BookingsPage() {
  const supabase = await createClient();

  const [{ data: bookings, error }, { data: units }, { data: guests }] = await Promise.all([
    supabase.from("bookings").select("*").order("check_in", { ascending: true }),
    supabase.from("units").select("id, name, nightly_rate").order("name", { ascending: true }),
    supabase.from("guests").select("id, full_name, phone").order("full_name", { ascending: true }),
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
          <p className="mt-1 text-sm text-muted">
            Reservations against a unit and date range — double-booking is rejected at the
            database level.
          </p>
        </div>
        <BookingFormDialog units={units ?? []} guests={guests ?? []} />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load bookings: {error.message}
        </div>
      )}

      {!error && bookings && bookings.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No bookings yet. Create the first reservation to get started.
        </div>
      )}

      {!error && bookings && bookings.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const guest = guestById.get(booking.guest_id);
                const paid = paidByBooking.get(booking.id) ?? 0;
                const balance = booking.total_amount - paid;
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
                    <td className="px-4 py-3 text-muted">{formatManilaDate(booking.check_in)}</td>
                    <td className="px-4 py-3 text-muted">{formatManilaDate(booking.check_out)}</td>
                    <td className="px-4 py-3">
                      <BookingStatusSelect bookingId={booking.id} status={booking.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatPeso(booking.total_amount)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${balance > 0 ? "text-danger" : "text-muted"}`}
                    >
                      {formatPeso(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/bookings/${booking.id}/receipt`}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
                          aria-label="View receipt"
                        >
                          <Receipt className="h-4 w-4" />
                        </Link>
                        <BookingFormDialog booking={booking} units={units ?? []} guests={guests ?? []} />
                        <DeleteBookingButton
                          bookingId={booking.id}
                          label={guest?.full_name ?? "booking"}
                        />
                      </div>
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
