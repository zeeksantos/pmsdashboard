"use client";

import { useActionState, useRef } from "react";
import { addLine } from "../../actions";

const input =
  "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function AddLineForm({ payslipId }: { payslipId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(async (prev: string | null, fd: FormData) => {
    const result = await addLine(prev, fd);
    if (!result) formRef.current?.reset();
    return result;
  }, null);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="payslip_id" value={payslipId} />
      <div>
        <label className="mb-1 block text-xs text-muted">Type</label>
        <select name="kind" className={input}>
          <option value="EARNING">Earning (adds pay)</option>
          <option value="DEDUCTION">Deduction (subtracts)</option>
        </select>
      </div>
      <div className="min-w-48 flex-1">
        <label className="mb-1 block text-xs text-muted">Description</label>
        <input name="label" required placeholder="e.g. Allowance, Cash advance" className={`${input} w-full`} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Amount (₱)</label>
        <input name="amount" type="number" step="0.01" min="0.01" required className={`${input} w-32`} />
      </div>
      <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
        {pending ? "Adding…" : "Add"}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
