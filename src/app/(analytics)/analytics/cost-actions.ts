"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditableWorkspace } from "@/lib/analytics/workspace";

export type UnitCostField = "rent" | "other_fixed" | "electricity" | "water" | "cleaning_per_stay";
export type MonthlyCostField = "cleaning" | "other";

const UNIT_FIELDS: UnitCostField[] = ["rent", "other_fixed", "electricity", "water", "cleaning_per_stay"];

function amount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter an amount of 0 or more.");
  return Math.round(n * 100) / 100;
}

/** Saves some of a unit's standard monthly bills (merged with what's stored). */
export async function saveUnitCosts(unitId: string, values: Partial<Record<UnitCostField, number>>) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const clean: Partial<Record<UnitCostField, number>> = {};
  for (const f of UNIT_FIELDS) if (f in values) clean[f] = amount(values[f]);
  const { error } = await supabase
    .from("an_unit_costs")
    .upsert({ unit_id: unitId, workspace_id: ws.workspace.id, ...clean }, { onConflict: "unit_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
}

/** Saves one unit's actual cleaning / other bills for a month (YYYY-MM). */
export async function saveMonthlyCosts(unitId: string, month: string, values: Partial<Record<MonthlyCostField, number>>) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month.");
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const clean: Partial<Record<MonthlyCostField, number>> = {};
  if ("cleaning" in values) clean.cleaning = amount(values.cleaning);
  if ("other" in values) clean.other = amount(values.other);
  const { error } = await supabase
    .from("an_monthly_costs")
    .upsert({ unit_id: unitId, workspace_id: ws.workspace.id, month: `${month}-01`, ...clean }, { onConflict: "unit_id,month" });
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
}

/** Copies every unit's cleaning / other bills from one month to another. */
export async function copyMonthlyCosts(fromMonth: string, toMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) throw new Error("Invalid month.");
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("an_monthly_costs")
    .select("unit_id, cleaning, other")
    .eq("workspace_id", ws.workspace.id)
    .eq("month", `${fromMonth}-01`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r) => Number(r.cleaning) > 0 || Number(r.other) > 0);
  if (rows.length) {
    const { error: upErr } = await supabase.from("an_monthly_costs").upsert(
      rows.map((r) => ({
        unit_id: r.unit_id,
        workspace_id: ws.workspace.id,
        month: `${toMonth}-01`,
        cleaning: Number(r.cleaning),
        other: Number(r.other),
      })),
      { onConflict: "unit_id,month" }
    );
    if (upErr) throw new Error(upErr.message);
  }
  revalidatePath("/analytics", "layout");
  return rows.length;
}

/** Sets every unit's cleaning-per-stay to its average channel cleaning fee. */
export async function fillCleaningFromFees(values: { unitId: string; perStay: number }[]) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("an_unit_costs")
    .select("unit_id")
    .eq("workspace_id", ws.workspace.id);
  const have = new Set((existing ?? []).map((r) => r.unit_id));
  for (const v of values) {
    const perStay = amount(Math.round(v.perStay));
    const { error } = have.has(v.unitId)
      ? await supabase.from("an_unit_costs").update({ cleaning_per_stay: perStay }).eq("unit_id", v.unitId)
      : await supabase.from("an_unit_costs").insert({ unit_id: v.unitId, workspace_id: ws.workspace.id, cleaning_per_stay: perStay });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/analytics", "layout");
}
