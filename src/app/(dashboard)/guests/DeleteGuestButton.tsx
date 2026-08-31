"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteGuest } from "./actions";

export function DeleteGuestButton({ guestId, guestName }: { guestId: string; guestName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${guestName}"? This cannot be undone.`)) return;
        startTransition(() => {
          deleteGuest(guestId).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete guest");
          });
        });
      }}
      className="rounded-md p-1.5 text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-60"
      aria-label={`Delete ${guestName}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
