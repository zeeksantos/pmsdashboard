import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate, formatManilaDateTime } from "@/lib/format";
import { PrintButton } from "./PrintButton";

export default async function BookingReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (!booking) notFound();

  const [{ data: guest }, { data: unit }, { data: payments }] = await Promise.all([
    supabase.from("guests").select("*").eq("id", booking.guest_id).single(),
    supabase.from("units").select("*").eq("id", booking.unit_id).single(),
    supabase
      .from("payments")
      .select("*")
      .eq("booking_id", booking.id)
      .order("paid_at", { ascending: true }),
  ]);

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = booking.total_amount - totalPaid;
  const nights = Math.max(
    0,
    Math.round((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86_400_000)
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="print:hidden flex items-center justify-between">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bookings
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-8 print:border-0 print:bg-white print:text-black">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground print:text-black">
              Bori Boracay PMS
            </h1>
            <p className="text-sm text-muted print:text-neutral-600">Booking Receipt</p>
          </div>
          <div className="text-right text-sm text-muted print:text-neutral-600">
            <div>Booking #{booking.id.slice(0, 8).toUpperCase()}</div>
            <div>{formatManilaDateTime(booking.created_at)}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-6 print:border-neutral-300">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted print:text-neutral-500">Guest</div>
            <div className="mt-1 font-medium text-foreground print:text-black">
              {guest?.full_name ?? "—"}
            </div>
            {guest?.phone && <div className="text-sm text-muted print:text-neutral-600">{guest.phone}</div>}
            {guest?.email && <div className="text-sm text-muted print:text-neutral-600">{guest.email}</div>}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted print:text-neutral-500">Unit</div>
            <div className="mt-1 font-medium text-foreground print:text-black">{unit?.name ?? "—"}</div>
            <div className="text-sm text-muted print:text-neutral-600">{unit?.unit_type}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted print:text-neutral-500">Check-in</div>
            <div className="mt-1 text-foreground print:text-black">{formatManilaDate(booking.check_in)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted print:text-neutral-500">Check-out</div>
            <div className="mt-1 text-foreground print:text-black">{formatManilaDate(booking.check_out)}</div>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-6 print:border-neutral-300">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted print:text-neutral-500">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border print:border-neutral-200">
                <td className="py-2 text-foreground print:text-black">
                  {unit?.name ?? "Unit"} · {nights} night{nights === 1 ? "" : "s"}
                </td>
                <td className="py-2 text-right text-foreground print:text-black">
                  {formatPeso(booking.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted print:text-neutral-600">Total</span>
            <span className="font-medium text-foreground print:text-black">
              {formatPeso(booking.total_amount)}
            </span>
          </div>

          {(payments ?? []).length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 print:border-neutral-200">
              {payments!.map((p) => (
                <div key={p.id} className="flex justify-between text-sm text-muted print:text-neutral-600">
                  <span>
                    {formatManilaDate(p.paid_at)} · {p.method.replace("_", " ")}
                  </span>
                  <span>−{formatPeso(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-semibold print:border-neutral-300">
            <span className="text-foreground print:text-black">Balance due</span>
            <span className={balance > 0 ? "text-danger" : "text-success"}>
              {formatPeso(balance)}
            </span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted print:text-neutral-500">
          Thank you for staying with us.
        </p>
      </div>
    </div>
  );
}
