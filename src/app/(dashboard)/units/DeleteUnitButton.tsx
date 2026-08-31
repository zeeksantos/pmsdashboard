"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteUnit } from "./actions";

export function DeleteUnitButton({ unitId, unitName }: { unitId: string; unitName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${unitName}"? This cannot be undone.`)) return;
        startTransition(() => {
          deleteUnit(unitId).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete unit");
          });
        });
      }}
      className="rounded-md p-1.5 text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-60"
      aria-label={`Delete ${unitName}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
