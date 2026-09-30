"use client";

import { useActionState } from "react";
import { createThirteenthRun } from "./actions";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function ThirteenthForm({ year }: { year: number }) {
  const [error, action, pending] = useActionState(createThirteenthRun, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="mb-1.5 block text-sm text-muted">Year *</label>
        <input name="year" type="number" required defaultValue={year} className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Pay date *</label>
        <input name="pay_date" type="date" required defaultValue={`${year}-12-20`} className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Label (optional)</label>
        <input name="label" placeholder={`13th month pay ${year}`} className={input} />
      </div>
      <div className="sm:col-span-3">
        <button disabled={pending} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
          {pending ? "Calculating…" : "Create 13th month draft"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">
          Uses your finalized regular runs that end in the year. By law it is due no later than December 24.
        </p>
      </div>
    </form>
  );
}
