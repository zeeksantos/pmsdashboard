"use client";

import { useState, useTransition } from "react";
import { checkInBooking } from "./actions";

export function CheckInButton({
  bookingId,
  disabled,
  disabledReason,
}: {
  bookingId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending || disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await checkInBooking(bookingId);
            if (result.error) setError(result.error);
          });
        }}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {isPending ? "Checking in…" : "Check In"}
      </button>
      {disabled && disabledReason && (
        <p className="max-w-[220px] text-right text-xs text-warning">{disabledReason}</p>
      )}
      {error && <p className="max-w-[220px] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
