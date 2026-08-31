"use client";

import { useState, useTransition } from "react";
import { checkOutBooking } from "./actions";

export function CheckOutButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              "Check out this guest? This flips the unit to DIRTY and creates a housekeeping task automatically."
            )
          )
            return;
          setError(null);
          startTransition(async () => {
            const result = await checkOutBooking(bookingId);
            if (result.error) setError(result.error);
          });
        }}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {isPending ? "Checking out…" : "Check Out"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
