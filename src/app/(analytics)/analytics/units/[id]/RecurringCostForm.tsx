"use client";

import { useActionState, useEffect, useRef } from "react";
import { RECURRING_CATEGORIES } from "@/lib/analytics/categories";
import { inputClass, primaryButton } from "@/components/analytics/ui";
import { addRecurringCost, type UnitFormState } from "../actions";

export function RecurringCostForm({ unitId, defaultStart }: { unitId: string; defaultStart: string }) {
  const [state, action, pending] = useActionState<UnitFormState, FormData>(addRecurringCost.bind(null, unitId), {
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <select name="category" aria-label="Category" className={`${inputClass} col-span-2 sm:col-span-1`} required>
        {RECURRING_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input name="monthly_amount" type="number" min="0" step="0.01" placeholder="Per month" aria-label="Amount per month" required className={inputClass} />
      <input name="starts_on" type="month" defaultValue={defaultStart} aria-label="From month" required className={inputClass} />
      <input name="ends_on" type="month" aria-label="Until month (optional)" title="Until (leave blank if ongoing)" className={inputClass} />
      <button type="submit" disabled={pending} className={`${primaryButton} col-span-2 sm:col-span-1`}>
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && <p className="col-span-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
