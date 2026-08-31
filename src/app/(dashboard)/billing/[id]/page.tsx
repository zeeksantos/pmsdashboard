import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt as ReceiptIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso, formatManilaDate, formatManilaDateTime } from "@/lib/format";
import { BOOKING_STATUS_STYLES } from "@/lib/status-colors";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentForm } from "./PaymentForm";
import { DeletePaymentButton } from "./DeletePaymentButton";

export default async function BillingDetailPage({
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
      .order("paid_at", { ascending: false }),
  ]);

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = booking.total_amount - totalPaid;

  return (
    <div>
      <Link href="/billing" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Billing
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {guest ? (
              <Link href={`/guests/${guest.id}`} className="hover:text-accent hover:underline">
                {guest.full_name}
              </Link>
            ) : (
              "Booking"
            )}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{unit?.name ?? "—"}</span>
            <span>
              {formatManilaDate(booking.check_in)} – {formatManilaDate(booking.check_out)}
            </span>
            <StatusBadge label={booking.status} className={BOOKING_STATUS_STYLES[booking.status]} />
          </div>
        </div>
        <Link
          href={`/bookings/${booking.id}/receipt`}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
        >
          <ReceiptIcon className="h-4 w-4" />
          View Receipt
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total" value={formatPeso(booking.total_amount)} />
        <SummaryCard label="Paid" value={formatPeso(totalPaid)} />
        <SummaryCard
          label={balance < 0 ? "Credit" : "Balance"}
          value={formatPeso(Math.abs(balance))}
          tone={balance > 0 ? "danger" : balance < 0 ? "success" : "default"}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentForm bookingId={booking.id} />

        <div>
          <h2 className="text-lg font-semibold text-foreground">Payment history</h2>
          {(!payments || payments.length === 0) && (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
              No payments recorded yet.
            </div>
          )}
          {payments && payments.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">{formatPeso(p.amount)}</div>
                    <div className="text-xs text-muted">
                      {PAYMENT_METHOD_LABELS[p.method]} · {formatManilaDateTime(p.paid_at)}
                      {p.reference_no ? ` · Ref: ${p.reference_no}` : ""}
                    </div>
                    {p.notes && <div className="mt-1 text-xs text-muted">{p.notes}</div>}
                  </div>
                  <DeletePaymentButton paymentId={p.id} bookingId={booking.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  tone?: "default" | "danger" | "success";
}) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
