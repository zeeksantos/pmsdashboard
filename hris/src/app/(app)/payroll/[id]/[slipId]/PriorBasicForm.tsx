"use client";

import { useActionState, useRef } from "react";
import { addPriorBasic } from "../../actions";

const input =
  "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function PriorBasicForm({ payslipId }: { payslipId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(async (prev: string | null, fd: FormData) => {
    const result = await addPriorBasic(prev, fd);
    if (!result) formRef.current?.reset();
    return result;
  }, null);
  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="payslip_id" value={payslipId} />
      <div>
        <label className="mb-1 block text-xs text-muted">Basic pay earned outside this system (₱)</label>
        <input name="basic" type="number" step="0.01" min="0.01" required className={`${input} w-56`} />
      </div>
      <button disabled={pending} className="rounded-lg bg-surface-raised px-4 py-2 text-sm hover:bg-border disabled:opacity-60">
        {pending ? "Adding…" : "Add ÷ 12"}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
