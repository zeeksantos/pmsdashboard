"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UnitStatus } from "@/lib/database.types";

export interface UnitFormState {
  error: string | null;
}

function parseUnitForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const unit_type = String(formData.get("unit_type") ?? "").trim();
  const max_capacity = Number(formData.get("max_capacity"));
  const nightly_rate = Number(formData.get("nightly_rate"));
  const amenitiesRaw = String(formData.get("amenities") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Name is required." } as const;
  if (!unit_type) return { error: "Unit type is required." } as const;
  if (!Number.isFinite(max_capacity) || max_capacity <= 0) {
    return { error: "Max capacity must be a positive number." } as const;
  }
  if (!Number.isFinite(nightly_rate) || nightly_rate < 0) {
    return { error: "Nightly rate must be zero or a positive number." } as const;
  }

  const amenities = amenitiesRaw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  return {
    error: null,
    values: {
      name,
      unit_type,
      max_capacity,
      nightly_rate,
      amenities,
      notes: notes || null,
    },
  } as const;
}

export async function createUnit(_prevState: UnitFormState, formData: FormData): Promise<UnitFormState> {
  const parsed = parseUnitForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("units").insert(parsed.values);
  if (error) return { error: error.message };

  revalidatePath("/units");
  return { error: null };
}

export async function updateUnit(
  unitId: string,
  _prevState: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const parsed = parseUnitForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("units").update(parsed.values).eq("id", unitId);
  if (error) return { error: error.message };

  revalidatePath("/units");
  return { error: null };
}

export async function updateUnitStatus(unitId: string, status: UnitStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ status }).eq("id", unitId);
  if (error) throw new Error(error.message);
  revalidatePath("/units");
}

export async function deleteUnit(unitId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("units").delete().eq("id", unitId);
  if (error) throw new Error(error.message);
  revalidatePath("/units");
}

export async function addUnitPhoto(unitId: string, storagePath: string, sortOrder: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("unit_photos").insert({
    unit_id: unitId,
    storage_path: storagePath,
    sort_order: sortOrder,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
}

export async function deleteUnitPhoto(photoId: string, unitId: string, storagePath: string) {
  const supabase = await createClient();

  await supabase.storage.from("unit-photos").remove([storagePath]);

  const { error } = await supabase.from("unit_photos").delete().eq("id", photoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
}
