"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Booking } from "@/lib/database.types";
import { createBooking, updateBooking, type BookingFormState } from "./actions";

const initialState: BookingFormState = { error: null };

interface UnitOption {
  id: string;
  name: string;
  nightly_rate: number;
}

interface GuestOption {
  id: string;
  full_name: string;
  phone: string | null;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function BookingFormDialog({
  booking,
  units,
  guests,
}: {
  booking?: Booking;
  units: UnitOption[];
  guests: GuestOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const action = booking ? updateBooking.bind(null, booking.id) : createBooking;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const wasPending = useRef(false);

  const [unitId, setUnitId] = useState(booking?.unit_id ?? units[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(booking?.check_in ?? "");
  const [checkOut, setCheckOut] = useState(booking?.check_out ?? "");
  const [totalAmount, setTotalAmount] = useState(booking?.total_amount ?? 0);
  const [guestMode, setGuestMode] = useState<"existing" | "new">("existing");
  const [guestId, setGuestId] = useState(guests[0]?.id ?? "");

  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  function recomputeAmount(nextUnitId: string, nextCheckIn: string, nextCheckOut: string) {
    const unit = unitById.get(nextUnitId);
    if (!unit) return;
    setTotalAmount(nightsBetween(nextCheckIn, nextCheckOut) * unit.nightly_rate);
  }

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      setIsOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <>
      {booking ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
          aria-label="Edit booking"
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
          New Booking
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">
              {booking ? "Edit Booking" : "New Booking"}
            </h2>

            <form action={formAction} className="mt-4 flex flex-col gap-4">
              {!booking && (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex gap-2">
                    <TabButton
                      active={guestMode === "existing"}
                      onClick={() => setGuestMode("existing")}
                    >
                      Existing guest
                    </TabButton>
                    <TabButton active={guestMode === "new"} onClick={() => setGuestMode("new")}>
                      New guest
                    </TabButton>
                  </div>

                  {guestMode === "existing" ? (
                    <select
                      name="guest_id"
                      value={guestId}
                      onChange={(e) => setGuestId(e.target.value)}
                      className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    >
                      {guests.length === 0 && <option value="">No guests yet — add one below</option>}
                      {guests.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.full_name} {g.phone ? `· ${g.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        name="new_guest_name"
                        placeholder="Full name"
                        required={guestMode === "new"}
                        className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          name="new_guest_phone"
                          placeholder="Phone"
                          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                        />
                        <input
                          name="new_guest_email"
                          placeholder="Email"
                          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="unit_id" className="text-sm font-medium text-foreground">
                  Unit
                </label>
                <select
                  id="unit_id"
                  name="unit_id"
                  value={unitId}
                  onChange={(e) => {
                    setUnitId(e.target.value);
                    recomputeAmount(e.target.value, checkIn, checkOut);
                  }}
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
                  <label htmlFor="check_in" className="text-sm font-medium text-foreground">
                    Check-in
                  </label>
                  <input
                    id="check_in"
                    name="check_in"
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      recomputeAmount(unitId, e.target.value, checkOut);
                    }}
                    required
                    className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="check_out" className="text-sm font-medium text-foreground">
                    Check-out
                  </label>
                  <input
                    id="check_out"
                    name="check_out"
                    type="date"
                    value={checkOut}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      recomputeAmount(unitId, checkIn, e.target.value);
                    }}
                    required
                    className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="total_amount" className="text-sm font-medium text-foreground">
                  Total amount (₱)
                </label>
                <input
                  id="total_amount"
                  name="total_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  required
                  className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
                <p className="text-xs text-muted">Auto-filled from nights × nightly rate — adjust as needed.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="notes" className="text-sm font-medium text-foreground">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={booking?.notes ?? ""}
                  rows={2}
                  className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

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
                  {isPending ? "Saving…" : booking ? "Save changes" : "Create booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
