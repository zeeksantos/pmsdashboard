"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DIRECT_SOURCES, PAYMENT_METHODS } from "@/lib/analytics/sources";
import { Dialog, Field, iconButton, inputClass, primaryButton, secondaryButton } from "@/components/analytics/ui";
import { saveDirectBooking, type DirectFormState } from "./actions";

export interface DirectBookingValues {
  id: string;
  unit_id: string | null;
  source: string | null;
  guest: string | null;
  contact: string | null;
  reference: string | null;
  check_in: string;
  check_out: string;
  booked_on: string | null;
  total: number;
  fees: number;
  payment_method: string | null;
  notes: string | null;
}

export function DirectBookingDialog({
  booking,
  units,
  today,
  currency,
}: {
  booking?: DirectBookingValues;
  units: { id: string; name: string }[];
  today: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const known = (DIRECT_SOURCES as readonly string[]).includes(booking?.source ?? "");
  const [source, setSource] = useState<string>(booking ? (known ? booking.source! : "Other") : "");
  const [state, action, pending] = useActionState<DirectFormState, FormData>(
    async (prev, fd) => {
      const result = await saveDirectBooking(booking?.id ?? null, prev, fd);
      if (result.ok && !result.warning) setOpen(false);
      return result;
    },
    { error: null }
  );

  return (
    <>
      {booking ? (
        <button type="button" onClick={() => setOpen(true)} className={iconButton} aria-label={`Edit booking for ${booking.guest ?? "guest"}`}>
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={primaryButton} disabled={!units.length}>
          <Plus className="h-4 w-4" /> Add direct booking
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={booking ? "Edit direct booking" : "Add a direct booking"} wide>
        {state.ok && state.warning ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">{state.warning}</p>
            <div>
              <button type="button" className={primaryButton} onClick={() => setOpen(false)}>
                OK
              </button>
            </div>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Unit">
                <select name="unit_id" required defaultValue={booking?.unit_id ?? (units.length === 1 ? units[0].id : "")} className={inputClass}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Where did the booking come from?">
                <select name="source" required value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {DIRECT_SOURCES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              {source === "Other" && (
                <Field label="Other source" hint="e.g. Travel agent, Carousell, Telegram group">
                  <input name="source_other" maxLength={40} defaultValue={known ? "" : booking?.source ?? ""} className={inputClass} />
                </Field>
              )}
              <Field label="Check-in">
                <input type="date" name="check_in" required defaultValue={booking?.check_in ?? ""} className={inputClass} />
              </Field>
              <Field label="Check-out">
                <input type="date" name="check_out" required defaultValue={booking?.check_out ?? ""} className={inputClass} />
              </Field>
              <Field label="Guest name">
                <input name="guest" maxLength={120} defaultValue={booking?.guest ?? ""} className={inputClass} />
              </Field>
              <Field label="Contact (optional)" hint="Phone, FB name or IG handle">
                <input name="contact" maxLength={120} defaultValue={booking?.contact ?? ""} className={inputClass} />
              </Field>
              <Field label={`Total the guest pays (${currency})`}>
                <input
                  name="total"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  required
                  defaultValue={booking ? String(booking.total) : ""}
                  className={inputClass}
                />
              </Field>
              <Field label={`Fees you pay (${currency}, optional)`} hint="Agent commission, card or transfer fees">
                <input name="fees" type="number" min={0} step="any" inputMode="decimal" defaultValue={booking?.fees ? String(booking.fees) : ""} className={inputClass} />
              </Field>
              <Field label="Paid via">
                <select name="payment_method" defaultValue={booking?.payment_method ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Booked on" hint="When the guest booked — used for lead time">
                <input type="date" name="booked_on" defaultValue={booking?.booked_on ?? today} className={inputClass} />
              </Field>
              <Field label="Reference (optional)">
                <input name="reference" maxLength={60} defaultValue={booking?.reference ?? ""} className={inputClass} placeholder="Receipt or GCash ref no." />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea name="notes" rows={2} maxLength={1000} defaultValue={booking?.notes ?? ""} className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={primaryButton}>
                {pending ? "Saving…" : "Save booking"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
