"use client";

import { useActionState } from "react";
import { saveLeaveType } from "../actions";

type T = { id?: string; name: string; default_days: number; has_balance: boolean; is_paid: boolean; active: boolean };

const input =
  "rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent";

export function TypeForm({ type }: { type?: T }) {
  const [error, action, pending] = useActionState(saveLeaveType, null);
  const t = type ?? { name: "", default_days: 0, has_balance: true, is_paid: true, active: true };
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {type?.id && <input type="hidden" name="id" value={type.id} />}
      <input name="name" required defaultValue={t.name} placeholder="Leave type name" className={`${input} w-44`} />
      <input name="default_days" type="number" step="0.5" min="0" defaultValue={t.default_days} className={`${input} w-20`} aria-label="Days per year" />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="has_balance" defaultChecked={t.has_balance} /> Capped</label>
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="is_paid" defaultChecked={t.is_paid} /> Paid</label>
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="active" defaultChecked={t.active} /> Active</label>
      <button disabled={pending} className="rounded-lg bg-surface-raised px-3 py-1.5 text-xs hover:bg-border disabled:opacity-60">
        {pending ? "Saving…" : type ? "Save" : "Add type"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </form>
  );
}
