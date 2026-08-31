"use client";

import { useTransition } from "react";
import type { MaintenanceStatus } from "@/lib/database.types";
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_STYLES } from "@/lib/status-colors";
import { updateTicketStatus } from "./actions";
import { cn } from "@/lib/cn";

export function TicketStatusSelect({ ticketId, status }: { ticketId: string; status: MaintenanceStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as MaintenanceStatus;
        startTransition(() => {
          updateTicketStatus(ticketId, next).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to update status");
          });
        });
      }}
      className={cn(
        "rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none disabled:opacity-60",
        MAINTENANCE_STATUS_STYLES[status]
      )}
    >
      {MAINTENANCE_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-surface text-foreground">
          {s}
        </option>
      ))}
    </select>
  );
}
