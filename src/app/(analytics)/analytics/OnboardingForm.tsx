"use client";

import { useActionState } from "react";
import { createWorkspace, type FormState } from "./actions";
import { Field, inputClass, primaryButton } from "@/components/analytics/ui";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createWorkspace, { error: null });
  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <Field label="Business name" hint="Shown on your dashboard and on owner statements. You can add a logo later.">
        <input name="name" required maxLength={80} placeholder="e.g. Seaside Stays PH" className={inputClass} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-foreground">How do you run your rentals?</legend>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-accent">
          <input type="radio" name="kind" value="host" defaultChecked className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-foreground">I host my own units</span>
            <span className="block text-xs text-muted">Track earnings, occupancy, expenses and profit per unit.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-accent">
          <input type="radio" name="kind" value="manager" className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-foreground">I manage units for owners</span>
            <span className="block text-xs text-muted">
              Everything above, plus owners, management fees and branded monthly owner statements.
            </span>
          </span>
        </label>
      </fieldset>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Setting up…" : "Start my free trial"}
      </button>
    </form>
  );
}
