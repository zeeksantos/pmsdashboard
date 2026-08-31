"use client";

import { useTransition } from "react";
import type { BookingStatus } from "@/lib/database.types";
import { BOOKING_STATUS_STYLES } from "@/lib/status-colors";
import { updateBookingStatus } from "./actions";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/StatusBadge";

// CHECKED_IN / CHECKED_OUT are deliberately not selectable here — those
// transitions must go through Check-In / Check-Out so the unit-status and
// housekeeping-task automation actually runs.
const QUICK_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CANCELLED"];

export function BookingStatusSelect({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const [isPending, startTransition] = useTransition();

  if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
    return (
      <StatusBadge
        label={status}
        className={cn(BOOKING_STATUS_STYLES[status], "cursor-default")}
      />
    );
  }

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as BookingStatus;
        startTransition(() => {
          updateBookingStatus(bookingId, next).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to update status");
          });
        });
      }}
      className={cn(
        "rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none disabled:opacity-60",
        BOOKING_STATUS_STYLES[status]
      )}
    >
      {QUICK_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-surface text-foreground">
          {s}
        </option>
      ))}
    </select>
  );
}
