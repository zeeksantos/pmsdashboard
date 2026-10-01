"use client";

import { useActionState, useRef } from "react";
import { addSalary } from "../actions";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function SalaryForm({ employeeId, today }: { employeeId: string; today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(async (prev: string | null, fd: FormData) => {
    const result = await addSalary(prev, fd);
    if (!result) formRef.current?.reset();
    return result;
  }, null);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="employee_id" value={employeeId} />
      <div>
        <label className="mb-1.5 block text-sm text-muted">Monthly rate (₱)</label>
        <input name="monthly_rate" type="number" step="0.01" min="0" className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Hourly rate (₱)</label>
        <input name="hourly_rate" type="number" step="0.01" min="0" className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Effective from *</label>
        <input name="effective_from" type="date" required defaultValue={today} className={input} />
      </div>
      <div className="sm:col-span-3">
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add salary"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}
