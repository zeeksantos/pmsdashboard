"use client";

import { useActionState } from "react";
import { inputClass, primaryButton } from "@/components/analytics/ui";
import { recordLicense, type LicenseFormState } from "./actions";

export function LicenseForm({ workspaceId, isPaid }: { workspaceId: string; isPaid: boolean }) {
  const [state, action, pending] = useActionState<LicenseFormState, FormData>(recordLicense.bind(null, workspaceId), {
    error: null,
  });
  return (
    <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <select name="kind" defaultValue={isPaid ? "renewed" : "activated"} aria-label="Event" className={`${inputClass} col-span-2 sm:col-span-1`}>
        <option value="activated">Activate</option>
        <option value="renewed">Renew</option>
        <option value="trial_extended">Extend trial</option>
      </select>
      <input name="years" type="number" min="0" defaultValue={1} aria-label="Years" title="Years" className={inputClass} />
      <input name="days" type="number" min="0" defaultValue={0} aria-label="Days" title="Days" className={inputClass} />
      <input name="amount" type="number" min="0" step="0.01" placeholder="₱ paid" aria-label="Amount paid" className={inputClass} />
      <input name="note" placeholder="GCash ref / note" aria-label="Note" className={inputClass} />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Saving…" : "Record"}
      </button>
      {state.error && <p className="col-span-full text-sm text-danger">{state.error}</p>}
      {state.message && <p className="col-span-full text-sm text-success">{state.message}</p>}
    </form>
  );
}
