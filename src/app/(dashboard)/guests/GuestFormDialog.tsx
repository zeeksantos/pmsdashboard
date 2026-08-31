"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Guest } from "@/lib/database.types";
import { createGuest, updateGuest, type GuestFormState } from "./actions";

const initialState: GuestFormState = { error: null };

export function GuestFormDialog({ guest }: { guest?: Guest }) {
  const [isOpen, setIsOpen] = useState(false);
  const action = guest ? updateGuest.bind(null, guest.id) : createGuest;
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
      {guest ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
          aria-label={`Edit ${guest.full_name}`}
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
          Add Guest
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">
              {guest ? `Edit ${guest.full_name}` : "Add Guest"}
            </h2>

            <form action={formAction} className="mt-4 flex flex-col gap-4">
              <Field label="Full name" name="full_name" defaultValue={guest?.full_name} required />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" name="phone" defaultValue={guest?.phone ?? ""} placeholder="09XX XXX XXXX" />
                <Field label="Email" name="email" type="email" defaultValue={guest?.email ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="ID type"
                  name="id_type"
                  defaultValue={guest?.id_type ?? ""}
                  placeholder="Passport, Driver's License…"
                />
                <Field label="ID number" name="id_number" defaultValue={guest?.id_number ?? ""} />
              </div>
              <Field label="Notes" name="notes" defaultValue={guest?.notes ?? ""} textarea />

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
                  {isPending ? "Saving…" : guest ? "Save changes" : "Add guest"}
                </button>
              </div>
            </form>
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
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      )}
    </div>
  );
}
