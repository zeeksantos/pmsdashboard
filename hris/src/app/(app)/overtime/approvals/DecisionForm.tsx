"use client";

import { useActionState } from "react";
import { decideOvertime } from "../actions";

export function DecisionForm({ id }: { id: string }) {
  const [error, action, pending] = useActionState(decideOvertime, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="note" placeholder="Note (optional)"
        className="w-44 rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-xs outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button name="decision" value="approve" disabled={pending}
          className="rounded-lg bg-success/20 px-3 py-1 text-xs text-success hover:bg-success/30 disabled:opacity-60">
          Approve
        </button>
        <button name="decision" value="reject" disabled={pending}
          className="rounded-lg bg-danger/20 px-3 py-1 text-xs text-danger hover:bg-danger/30 disabled:opacity-60">
          Reject
        </button>
      </div>
      {error && <p className="max-w-44 text-xs text-danger">{error}</p>}
    </form>
  );
}
