"use client";

import { useActionState, useRef } from "react";
import { requestOvertime } from "./actions";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function OvertimeForm({ today }: { today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(async (prev: string | null, fd: FormData) => {
    const result = await requestOvertime(prev, fd);
    if (!result) formRef.current?.reset();
    return result;
  }, null);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm text-muted">Date worked</label>
        <input name="work_date" type="date" required max={today} defaultValue={today} className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Overtime hours (beyond your shift)</label>
        <input name="hours" type="number" required min="0.25" max="12" step="0.25" placeholder="e.g. 2" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm text-muted">Reason / what you worked on</label>
        <input name="reason" className={input} />
      </div>
      <div className="sm:col-span-2">
        <button disabled={pending} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
          {pending ? "Submitting…" : "Request overtime"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">You can only file for a day you timed in. Only approved hours are paid.</p>
      </div>
    </form>
  );
}
