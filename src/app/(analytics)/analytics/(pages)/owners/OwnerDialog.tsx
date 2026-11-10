"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { AnOwner } from "@/lib/database.types";
import { Dialog, Field, iconButton, inputClass, primaryButton, secondaryButton } from "@/components/analytics/ui";
import { saveOwner, type OwnerFormState } from "./actions";

export function OwnerDialog({ owner }: { owner?: AnOwner }) {
  const [open, setOpen] = useState(false);
  // Close the dialog once a save succeeds.
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(async (prev, fd) => {
    const result = await saveOwner(owner?.id ?? null, prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, { error: null });
  return (
    <>
      {owner ? (
        <button type="button" onClick={() => setOpen(true)} className={iconButton} aria-label={`Edit ${owner.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
          <Plus className="h-4 w-4" /> Add owner
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={owner ? `Edit ${owner.name}` : "Add owner"}>
        <form action={action} className="flex flex-col gap-4">
          <Field label="Owner name">
            <input name="name" defaultValue={owner?.name} required className={inputClass} />
          </Field>
          <Field label="E-mail" hint="For your reference — statements are downloaded and sent by you.">
            <input type="email" name="email" defaultValue={owner?.email ?? ""} className={inputClass} />
          </Field>
          <Field label="Management fee (%)" hint="Charged on the unit's net channel earnings each month (never on a loss).">
            <input
              type="number"
              name="management_fee_pct"
              min="0"
              max="100"
              step="0.01"
              defaultValue={owner?.management_fee_pct ?? 20}
              className={inputClass}
            />
          </Field>
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={owner?.notes ?? ""} className={inputClass} />
          </Field>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
