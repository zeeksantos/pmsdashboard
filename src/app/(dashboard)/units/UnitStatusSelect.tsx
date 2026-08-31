"use client";

import { useTransition } from "react";
import type { UnitStatus } from "@/lib/database.types";
import { UNIT_STATUSES, UNIT_STATUS_STYLES } from "@/lib/status-colors";
import { updateUnitStatus } from "./actions";
import { cn } from "@/lib/cn";

export function UnitStatusSelect({ unitId, status }: { unitId: string; status: UnitStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as UnitStatus;
        startTransition(() => {
          updateUnitStatus(unitId, next).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to update status");
          });
        });
      }}
      className={cn(
        "rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none disabled:opacity-60",
        UNIT_STATUS_STYLES[status]
      )}
    >
      {UNIT_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-surface text-foreground">
          {s}
        </option>
      ))}
    </select>
  );
}
