"use client";

import { useState, useTransition } from "react";
import type { HousekeepingTaskStatus } from "@/lib/database.types";
import { startTask, completeTask } from "./actions";

export function TaskActions({ taskId, status }: { taskId: string; status: HousekeepingTaskStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "COMPLETED") {
    return null;
  }

  const action = status === "PENDING" ? startTask : completeTask;
  const label = status === "PENDING" ? "Start Cleaning" : "Mark Complete";
  const pendingLabel = status === "PENDING" ? "Starting…" : "Completing…";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action(taskId);
            if (result.error) setError(result.error);
          });
        }}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {isPending ? pendingLabel : label}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
