"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { MaintenanceTicket } from "@/lib/database.types";
import { MAINTENANCE_PRIORITIES } from "@/lib/status-colors";
import { createTicket, updateTicket, type TicketFormState } from "./actions";

const initialState: TicketFormState = { error: null };

interface UnitOption {
  id: string;
  name: string;
}

interface TechnicianOption {
  id: string;
  full_name: string;
}

export function TicketFormDialog({
  ticket,
  units,
  technicians,
}: {
  ticket?: MaintenanceTicket;
  units: UnitOption[];
  technicians: TechnicianOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const action = ticket ? updateTicket.bind(null, ticket.id) : createTicket;
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
      {ticket ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
          aria-label="Edit ticket"
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
          New Ticket
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">
              {ticket ? "Edit Ticket" : "New Ticket"}
            </h2>

            <form action={formAction} className="mt-4 flex flex-col gap-4">
              <Field label="Title" name="title" defaultValue={ticket?.title} required />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="unit_id" className="text-sm font-medium text-foreground">
                  Unit
                </label>
                <select
                  id="unit_id"
                  name="unit_id"
                  defaultValue={ticket?.unit_id ?? units[0]?.id ?? ""}
                  required
                  className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="priority" className="text-sm font-medium text-foreground">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue={ticket?.priority ?? "MEDIUM"}
                    className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  >
                    {MAINTENANCE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="assigned_to" className="text-sm font-medium text-foreground">
                    Assigned to
                  </label>
                  <select
                    id="assigned_to"
                    name="assigned_to"
                    defaultValue={ticket?.assigned_to ?? ""}
                    className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Field
                label="Description"
                name="description"
                defaultValue={ticket?.description ?? ""}
                textarea
              />

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
                  {isPending ? "Saving…" : ticket ? "Save changes" : "Create ticket"}
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
  required,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
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
          rows={3}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      ) : (
        <input
          id={name}
          name={name}
          defaultValue={defaultValue}
          required={required}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      )}
    </div>
  );
}
