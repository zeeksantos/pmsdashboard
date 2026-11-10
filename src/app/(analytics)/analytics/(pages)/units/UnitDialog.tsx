"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { AnOwner, AnUnit } from "@/lib/database.types";
import { Dialog, Field, iconButton, inputClass, primaryButton, secondaryButton } from "@/components/analytics/ui";
import { saveUnit, type UnitFormState } from "./actions";

export function UnitDialog({ unit, owners, showOwners }: { unit?: AnUnit; owners: AnOwner[]; showOwners: boolean }) {
  const [open, setOpen] = useState(false);
  // Close the dialog once a save succeeds.
  const [state, action, pending] = useActionState<UnitFormState, FormData>(async (prev, fd) => {
    const result = await saveUnit(unit?.id ?? null, prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, { error: null });

  return (
    <>
      {unit ? (
        <button type="button" onClick={() => setOpen(true)} className={iconButton} aria-label={`Edit ${unit.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
          <Plus className="h-4 w-4" /> Add unit
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={unit ? `Edit ${unit.name}` : "Add unit"}>
        <form action={action} className="flex flex-col gap-4">
          <Field label="Unit name" hint="What you call the physical unit, e.g. 908C or Villa 2.">
            <input name="name" defaultValue={unit?.name} required maxLength={80} className={inputClass} />
          </Field>
          <Field label="Nickname" hint="Optional short name shown under the unit on the dashboard, e.g. Corner studio.">
            <input name="nickname" defaultValue={unit?.nickname ?? ""} maxLength={80} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Building / property">
              <input name="building" defaultValue={unit?.building ?? ""} className={inputClass} placeholder="Mplace Tower C" />
            </Field>
            <Field label="Area" hint="Units in the same area are compared for pricing alerts.">
              <input name="area" defaultValue={unit?.area ?? ""} className={inputClass} placeholder="Quezon City" />
            </Field>
          </div>
          {showOwners && (
            <Field label="Owner">
              <select name="owner_id" defaultValue={unit?.owner_id ?? ""} className={inputClass}>
                <option value="">— none —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label="Operating since"
            hint="Occupancy is measured from this date. Filled in from the first stay automatically if left blank."
          >
            <input type="date" name="active_from" defaultValue={unit?.active_from ?? ""} className={inputClass} />
          </Field>
          <Field label="Notes">
            <textarea name="notes" defaultValue={unit?.notes ?? ""} rows={2} className={inputClass} />
          </Field>
          {unit && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="archived" defaultChecked={unit.archived} />
              Archived (no longer operating — hidden from alerts)
            </label>
          )}
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
