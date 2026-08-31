"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTicket } from "./actions";

export function DeleteTicketButton({ ticketId, title }: { ticketId: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete ticket "${title}"? This cannot be undone.`)) return;
        startTransition(() => {
          deleteTicket(ticketId).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete ticket");
          });
        });
      }}
      className="rounded-md p-1.5 text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-60"
      aria-label={`Delete ${title}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
