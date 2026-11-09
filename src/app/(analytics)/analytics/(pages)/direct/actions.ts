"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditableWorkspace } from "@/lib/analytics/workspace";
import { refreshUnitStartDates } from "@/lib/analytics/units";
import { DIRECT_SOURCES, PAYMENT_METHODS, normaliseSource } from "@/lib/analytics/sources";
import { getManilaToday } from "@/lib/calendar";
import { round2 } from "@/lib/analytics/values";

export interface DirectFormState {
  error: string | null;
  ok?: boolean;
  warning?: string;
}

const text = (fd: FormData, key: string, max = 120) => {
  const v = String(fd.get(key) ?? "").trim().slice(0, max);
  return v || null;
};
const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const money = (v: string | null) => {
  if (v == null || v === "") return null;
  const n = Number(v.replace(/[,₱\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** The unit's "Direct" listing — every direct booking hangs off one, so the
 * reports treat it like any other channel listing on that unit. */
async function directListingFor(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, unitId: string) {
  const { data: existing } = await supabase
    .from("an_listings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("channel", "direct")
    .eq("unit_id", unitId)
    .limit(1);
  if (existing?.[0]) return existing[0].id;
  const { data: unit } = await supabase.from("an_units").select("name").eq("id", unitId).eq("workspace_id", workspaceId).single();
  if (!unit) throw new Error("Pick a unit.");
  // external_name must be unique per channel; the unit id keeps it so even if two units share a name.
  const { data, error } = await supabase
    .from("an_listings")
    .insert({ workspace_id: workspaceId, channel: "direct", external_name: `Direct · ${unit.name} · ${unitId.slice(0, 6)}`, unit_id: unitId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't set up direct bookings for that unit.");
  return data.id;
}

export async function saveDirectBooking(id: string | null, _prev: DirectFormState, fd: FormData): Promise<DirectFormState> {
  let ws;
  try {
    ws = await requireEditableWorkspace();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const unitId = text(fd, "unit_id", 40);
  const sourceRaw = text(fd, "source", 40);
  const sourceOther = text(fd, "source_other", 40);
  const source = sourceRaw === "Other" && sourceOther ? normaliseSource(sourceOther) : sourceRaw;
  const checkIn = isoDate(text(fd, "check_in", 10));
  const checkOut = isoDate(text(fd, "check_out", 10));
  const bookedOn = isoDate(text(fd, "booked_on", 10)) ?? getManilaToday();
  const total = money(text(fd, "total", 20));
  const fees = money(text(fd, "fees", 20)) ?? 0;
  const payment = text(fd, "payment_method", 40);

  if (!unitId) return { error: "Pick the unit." };
  if (!sourceRaw || !(DIRECT_SOURCES as readonly string[]).includes(sourceRaw) || !source)
    return { error: "Pick where the booking came from." };
  if (!checkIn || !checkOut) return { error: "Enter the check-in and check-out dates." };
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) return { error: "Check-out must be after check-in." };
  if (nights > 366) return { error: "That stay is longer than a year — check the dates." };
  if (total == null || Number.isNaN(total) || total < 0) return { error: "Enter the total the guest pays (0 or more)." };
  if (Number.isNaN(fees) || fees < 0) return { error: "Fees must be 0 or more." };
  if (fees > total) return { error: "Fees can't be more than the total." };
  if (payment && !(PAYMENT_METHODS as readonly string[]).includes(payment)) return { error: "Pick a payment method." };

  const supabase = await createClient();
  const workspaceId = ws.workspace.id;
  let listingId: string;
  try {
    listingId = await directListingFor(supabase, workspaceId, unitId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const currency = ws.workspace.base_currency;
  const values = {
    listing_id: listingId,
    channel: "direct" as const,
    kind: "booking" as const,
    raw_type: "Direct booking",
    txn_date: bookedOn > checkIn ? checkIn : bookedOn,
    booked_on: bookedOn,
    confirmation_code: text(fd, "reference", 60),
    guest_name: text(fd, "guest", 120),
    check_in: checkIn,
    check_out: checkOut,
    nights,
    currency,
    amount: round2(total - fees),
    fx_rate: 1,
    amount_base: round2(total - fees),
    gross: round2(total),
    service_fee: round2(fees),
    cleaning_fee: null,
    details: text(fd, "contact", 120),
    source,
    payment_method: payment,
    notes: text(fd, "notes", 1000),
    pending: false,
  };

  // Same unit already booked for any of those nights (any channel)? Checked
  // before saving so the booking being saved isn't compared with itself.
  let warning: string | undefined;
  const { data: unitListings } = await supabase.from("an_listings").select("id").eq("workspace_id", workspaceId).eq("unit_id", unitId);
  const ids = (unitListings ?? []).map((l) => l.id);
  if (ids.length) {
    let q = supabase
      .from("an_transactions")
      .select("guest_name, check_in, check_out, channel, source")
      .eq("workspace_id", workspaceId)
      .in("listing_id", ids)
      .in("kind", ["booking", "cohost"])
      .gt("amount_base", 0)
      .lt("check_in", checkOut)
      .gt("check_out", checkIn)
      .limit(1);
    if (id) q = q.neq("id", id);
    const { data: clash } = await q;
    const c = clash?.[0];
    if (c) {
      warning = `Saved — but this unit already has a booking for some of those nights (${c.guest_name ?? "a guest"}, ${c.check_in} to ${c.check_out}, ${c.source ?? c.channel}). Check it isn't a double booking.`;
    }
  }

  const { error } = id
    ? await supabase.from("an_transactions").update(values).eq("id", id).eq("workspace_id", workspaceId).eq("channel", "direct")
    : await supabase.from("an_transactions").insert({ ...values, workspace_id: workspaceId, dedupe_key: `direct:${crypto.randomUUID()}` });
  if (error) return { error: error.message };

  await refreshUnitStartDates(supabase, workspaceId, [unitId]);
  revalidatePath("/analytics", "layout");
  return { error: null, ok: true, warning };
}

export async function deleteDirectBooking(id: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("an_transactions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ws.workspace.id)
    .eq("channel", "direct");
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
}
