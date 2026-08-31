"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBooking } from "./actions";

export function DeleteBookingButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete booking for "${label}"? This cannot be undone.`)) return;
        startTransition(() => {
          deleteBooking(bookingId).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete booking");
          });
        });
      }}
      className="rounded-md p-1.5 text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-60"
      aria-label={`Delete booking for ${label}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
