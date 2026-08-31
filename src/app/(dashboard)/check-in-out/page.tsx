import Link from "next/link";
import { Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate } from "@/lib/format";
import { CheckInButton } from "./CheckInButton";
import { CheckOutButton } from "./CheckOutButton";

export default async function CheckInOutPage() {
  const supabase = await createClient();

  const [{ data: arrivals }, { data: departures }, { data: units }, { data: guests }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .in("status", ["PENDING", "CONFIRMED"])
        .order("check_in", { ascending: true }),
      supabase
        .from("bookings")
        .select("*")
        .eq("status", "CHECKED_IN")
        .order("check_out", { ascending: true }),
      supabase.from("units").select("id, name, status"),
      supabase.from("guests").select("id, full_name, phone"),
    ]);

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const guestById = new Map((guests ?? []).map((g) => [g.id, g]));

  const departureIds = (departures ?? []).map((b) => b.id);
  const { data: payments } =
    departureIds.length > 0
      ? await supabase.from("payments").select("booking_id, amount").in("booking_id", departureIds)
      : { data: [] as { booking_id: string; amount: number }[] };

  const paidByBooking = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + p.amount);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Check-In / Check-Out</h1>
      <p className="mt-1 text-sm text-muted">
        Check-out automatically flips the unit to DIRTY and creates a housekeeping task.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Arrivals</h2>
      {(!arrivals || arrivals.length === 0) && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No pending or confirmed bookings waiting to check in.
        </div>
      )}
      {arrivals && arrivals.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Unit status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {arrivals.map((booking) => {
                const guest = guestById.get(booking.guest_id);
                const unit = unitById.get(booking.unit_id);
                const isAvailable = unit?.status === "AVAILABLE";
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
                    <td className="px-4 py-3 text-muted">{unit?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatManilaDate(booking.check_in)}</td>
                    <td className="px-4 py-3 text-muted">{unit?.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <CheckInButton
                          bookingId={booking.id}
                          disabled={!isAvailable}
                          disabledReason={
                            isAvailable ? undefined : `Unit is ${unit?.status} — mark it AVAILABLE first.`
                          }
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

      <h2 className="mt-10 text-lg font-semibold text-foreground">Departures</h2>
      {(!departures || departures.length === 0) && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No guests currently checked in.
        </div>
      )}
      {departures && departures.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {departures.map((booking) => {
                const guest = guestById.get(booking.guest_id);
                const unit = unitById.get(booking.unit_id);
                const balance = booking.total_amount - (paidByBooking.get(booking.id) ?? 0);
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
                    <td className="px-4 py-3 text-muted">{unit?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatManilaDate(booking.check_out)}</td>
                    <td className={`px-4 py-3 text-right ${balance > 0 ? "text-danger" : "text-muted"}`}>
                      {formatPeso(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/bookings/${booking.id}/receipt`}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
                          aria-label="View receipt"
                        >
                          <Receipt className="h-4 w-4" />
                        </Link>
                        <CheckOutButton bookingId={booking.id} />
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
