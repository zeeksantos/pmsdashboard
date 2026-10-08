"use client";

import { useActionState } from "react";
import { cancelOvertime } from "./actions";

export function CancelButton({ id }: { id: string }) {
  const [error, action, pending] = useActionState(cancelOvertime, null);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("Cancel this overtime request?")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-xs text-danger hover:underline disabled:opacity-60">
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </form>
  );
}
