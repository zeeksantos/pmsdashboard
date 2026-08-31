import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate } from "@/lib/format";
import { BOOKING_STATUS_STYLES } from "@/lib/status-colors";
import { StatusBadge } from "@/components/StatusBadge";
import { GuestFormDialog } from "../GuestFormDialog";

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: guest } = await supabase.from("guests").select("*").eq("id", id).single();
  if (!guest) notFound();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("guest_id", id)
    .order("check_in", { ascending: false });

  const unitIds = [...new Set((bookings ?? []).map((b) => b.unit_id))];
  const { data: units } =
    unitIds.length > 0
      ? await supabase.from("units").select("id, name").in("id", unitIds)
      : { data: [] as { id: string; name: string }[] };
  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const { data: payments } =
    bookingIds.length > 0
      ? await supabase.from("payments").select("*").in("booking_id", bookingIds)
      : { data: [] as { amount: number }[] };

  const activeBookings = (bookings ?? []).filter((b) => b.status !== "CANCELLED");
  const totalBooked = activeBookings.reduce((sum, b) => sum + b.total_amount, 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = totalBooked - totalPaid;

  return (
    <div>
      <Link
        href="/guests"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Guests
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{guest.full_name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {guest.phone && <span>{guest.phone}</span>}
            {guest.email && <span>{guest.email}</span>}
            {guest.id_type && (
              <span>
                {guest.id_type} · {guest.id_number ?? "—"}
              </span>
            )}
          </div>
          {guest.notes && <p className="mt-2 max-w-xl text-sm text-muted">{guest.notes}</p>}
        </div>
        <GuestFormDialog guest={guest} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Stays" value={String(activeBookings.length)} />
        <SummaryCard label="Total paid" value={formatPeso(totalPaid)} />
        <SummaryCard
          label="Balance"
          value={formatPeso(balance)}
          tone={balance > 0 ? "danger" : "default"}
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Stay history</h2>

      {(!bookings || bookings.length === 0) && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No bookings yet. This will populate automatically once the Bookings module is in use.
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {unitNameById.get(booking.unit_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatManilaDate(booking.check_in)}</td>
                  <td className="px-4 py-3 text-muted">{formatManilaDate(booking.check_out)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={booking.status}
                      className={BOOKING_STATUS_STYLES[booking.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatPeso(booking.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "danger" ? "text-danger" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
