"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireEditableWorkspace } from "@/lib/analytics/workspace";
import { refreshUnitStartDates } from "@/lib/analytics/units";
import { EXPENSE_CATEGORIES } from "@/lib/analytics/categories";

export interface UnitFormState {
  error: string | null;
  ok?: boolean;
}

function text(fd: FormData, key: string, max = 120): string | null {
  const v = String(fd.get(key) ?? "").trim().slice(0, max);
  return v || null;
}

function isoDate(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function saveUnit(unitId: string | null, _prev: UnitFormState, fd: FormData): Promise<UnitFormState> {
  let ws;
  try {
    ws = await requireEditableWorkspace();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = text(fd, "name", 80);
  if (!name) return { error: "Give the unit a name." };

  const values = {
    name,
    building: text(fd, "building"),
    area: text(fd, "area"),
    owner_id: text(fd, "owner_id", 40),
    active_from: isoDate(text(fd, "active_from", 10)),
    archived: fd.get("archived") === "on",
    notes: text(fd, "notes", 1000),
  };

  const supabase = await createClient();
  const { error } = unitId
    ? await supabase.from("an_units").update(values).eq("id", unitId).eq("workspace_id", ws.workspace.id)
    : await supabase.from("an_units").insert({ ...values, workspace_id: ws.workspace.id });
  if (error) return { error: error.message };

  revalidatePath("/analytics", "layout");
  return { error: null, ok: true };
}

export async function deleteUnit(unitId: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("an_units").delete().eq("id", unitId).eq("workspace_id", ws.workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
  redirect("/analytics/units");
}

/** Link a channel listing to a unit; "new" creates a unit named after it. */
export async function linkListing(listingId: string, target: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const workspaceId = ws.workspace.id;

  let unitId: string | null = target || null;
  if (target === "new") {
    const { data: listing } = await supabase
      .from("an_listings")
      .select("external_name")
      .eq("id", listingId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!listing) throw new Error("Listing not found.");
    const { data: unit, error } = await supabase
      .from("an_units")
      .insert({ workspace_id: workspaceId, name: listing.external_name.slice(0, 80) })
      .select("id")
      .single();
    if (error || !unit) throw new Error(error?.message ?? "Couldn't create the unit.");
    unitId = unit.id;
  }

  const { error } = await supabase
    .from("an_listings")
    .update({ unit_id: unitId })
    .eq("id", listingId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);

  if (unitId) await refreshUnitStartDates(supabase, workspaceId, [unitId]);
  revalidatePath("/analytics", "layout");
}

export async function addRecurringCost(unitId: string, _prev: UnitFormState, fd: FormData): Promise<UnitFormState> {
  let ws;
  try {
    ws = await requireEditableWorkspace();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const category = String(fd.get("category") ?? "");
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { error: "Pick a category." };
  const amount = Number(fd.get("monthly_amount"));
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the monthly amount." };
  const startMonth = String(fd.get("starts_on") ?? "");
  const endMonth = String(fd.get("ends_on") ?? "");
  if (!/^\d{4}-\d{2}$/.test(startMonth)) return { error: "Pick the first month this cost applies." };
  if (endMonth && (!/^\d{4}-\d{2}$/.test(endMonth) || endMonth < startMonth)) {
    return { error: "The last month must be on or after the first month." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("an_recurring_costs").insert({
    workspace_id: ws.workspace.id,
    unit_id: unitId,
    category,
    monthly_amount: amount,
    starts_on: `${startMonth}-01`,
    ends_on: endMonth ? `${endMonth}-01` : null,
    notes: text(fd, "notes", 300),
  });
  if (error) return { error: error.message };
  revalidatePath("/analytics", "layout");
  return { error: null, ok: true };
}

export async function deleteRecurringCost(costId: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("an_recurring_costs")
    .delete()
    .eq("id", costId)
    .eq("workspace_id", ws.workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
}
