"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Unit } from "@/lib/database.types";
import { createUnit, updateUnit, type UnitFormState } from "./actions";
import { UnitPhotoManager } from "./UnitPhotoManager";

const initialState: UnitFormState = { error: null };

export function UnitFormDialog({ unit }: { unit?: Unit }) {
  const [isOpen, setIsOpen] = useState(false);
  const action = unit ? updateUnit.bind(null, unit.id) : createUnit;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      setIsOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <>
      {unit ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
          aria-label={`Edit ${unit.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          Add Unit
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
          <div
            className={`relative flex w-full max-h-[90vh] flex-col rounded-xl border border-border bg-surface p-6 shadow-xl ${
              unit ? "max-w-2xl" : "max-w-md"
            }`}
          >
            <h2 className="text-lg font-semibold text-foreground">
              {unit ? `Edit ${unit.name}` : "Add Unit"}
            </h2>

            <div className="mt-4 overflow-y-auto">
              <form action={formAction} className="flex flex-col gap-4">
                <Field label="Name" name="name" defaultValue={unit?.name} required />
                <Field
                  label="Unit type"
                  name="unit_type"
                  defaultValue={unit?.unit_type}
                  placeholder="Studio, Deluxe Room, Family Suite…"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Max capacity"
                    name="max_capacity"
                    type="number"
                    min={1}
                    defaultValue={unit?.max_capacity ?? 2}
                    required
                  />
                  <Field
                    label="Nightly rate (₱)"
                    name="nightly_rate"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={unit?.nightly_rate ?? 0}
                    required
                  />
                </div>
                <Field
                  label="Amenities (comma-separated)"
                  name="amenities"
                  defaultValue={unit?.amenities.join(", ")}
                  placeholder="Wi-Fi, Aircon, TV"
                />
                <Field label="Notes" name="notes" defaultValue={unit?.notes ?? ""} textarea />

                {state.error && <p className="text-sm text-danger">{state.error}</p>}

                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-raised hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
                  >
                    {isPending ? "Saving…" : unit ? "Save changes" : "Create unit"}
                  </button>
                </div>
              </form>

              {unit && (
                <div className="mt-6 border-t border-border pt-6">
                  <UnitPhotoManager unitId={unit.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  min,
  step,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  step?: string;
  textarea?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          rows={2}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          min={min}
          step={step}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      )}
    </div>
  );
}
