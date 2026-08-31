"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePayment } from "./actions";

export function DeletePaymentButton({ paymentId, bookingId }: { paymentId: string; bookingId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this payment record? This cannot be undone.")) return;
        startTransition(() => {
          deletePayment(paymentId, bookingId).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete payment");
          });
        });
      }}
      className="rounded-md p-1.5 text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-60"
      aria-label="Delete payment"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
