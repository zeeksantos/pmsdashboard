"use client";

import { useActionState } from "react";
import { setAllocation } from "../actions";

const input =
  "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function AllocationForm({
  employees, types, year,
}: {
  employees: { id: string; full_name: string }[];
  types: { id: string; name: string }[];
  year: number;
}) {
  const [msg, action, pending] = useActionState(setAllocation, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-muted">Employee</label>
        <select name="employee_id" required className={input}>
          {employees.map((e) => (<option key={e.id} value={e.id}>{e.full_name}</option>))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Leave type</label>
        <select name="leave_type_id" required className={input}>
          {types.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Year</label>
        <input name="year" type="number" defaultValue={year} className={`${input} w-24`} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Days (blank = use default)</label>
        <input name="days" type="number" step="0.5" min="0" className={`${input} w-32`} />
      </div>
      <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
      {msg && <span className="text-sm text-danger">{msg}</span>}
    </form>
  );
}
