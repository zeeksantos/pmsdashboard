"use client";

import { useActionState, useRef } from "react";
import { addCompanyEvent } from "./actions";
import { companyEventKinds, companyKindLabels } from "@/lib/company-events";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function AddEventForm({ today }: { today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: Parameters<typeof addCompanyEvent>[0], fd: FormData) => {
      const result = await addCompanyEvent(prev, fd);
      if (result?.ok) formRef.current?.reset();
      return result;
    },
    null
  );

  return (
    <form ref={formRef} action={action} className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">Add to the calendar</h2>
      <p className="mt-1 text-sm text-muted">Company events, or a holiday that isn&apos;t listed yet. Everyone can see it.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-muted">Title *</label>
          <input name="title" required maxLength={120} placeholder="e.g. Company outing" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Type *</label>
          <select name="kind" defaultValue="EVENT" className={input}>
            {companyEventKinds.map((k) => (<option key={k} value={k}>{companyKindLabels[k]}</option>))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-muted">Date *</label>
            <input name="start_date" type="date" required defaultValue={today} className={input} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Until (optional)</label>
            <input name="end_date" type="date" className={input} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-muted">Note (optional)</label>
          <input name="note" maxLength={500} placeholder="Where, what to bring, who it is for…" className={input} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
          {pending ? "Adding…" : "Add"}
        </button>
        {state && <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>}
      </div>
    </form>
  );
}
