"use client";

import { useActionState, useEffect, useRef } from "react";
import { Paperclip } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/analytics/categories";
import { Field, inputClass, primaryButton } from "@/components/analytics/ui";
import { addExpense, type ExpenseFormState } from "./actions";

export function ExpenseForm({ units, today }: { units: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(addExpense, { error: null });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date paid">
          <input type="date" name="spent_on" defaultValue={today} required className={inputClass} />
        </Field>
        <Field label="Amount">
          <input type="number" name="amount" min="0.01" step="0.01" required className={inputClass} />
        </Field>
      </div>
      <Field label="Unit">
        <select name="unit_id" className={inputClass} defaultValue="">
          <option value="">Whole portfolio (not one unit)</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <select name="category" className={inputClass} required defaultValue="Repairs & maintenance">
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <input name="description" maxLength={500} placeholder="e.g. Aircon cleaning" className={inputClass} />
      </Field>
      <Field label="Receipt (optional)" hint="Photo or PDF, up to 8 MB. Only people in this workspace can open it.">
        <span className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="file"
            name="receipt"
            accept="image/*,application/pdf"
            className="w-full text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-foreground"
          />
        </span>
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Expense saved.</p>}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Saving…" : "Add expense"}
      </button>
    </form>
  );
}
