"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditableWorkspace } from "@/lib/analytics/workspace";

export interface OwnerFormState {
  error: string | null;
  ok?: boolean;
}

export async function saveOwner(ownerId: string | null, _prev: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  let ws;
  try {
    ws = await requireEditableWorkspace();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { error: "Enter the owner's name." };
  const fee = Number(fd.get("management_fee_pct") ?? 0);
  if (!Number.isFinite(fee) || fee < 0 || fee > 100) return { error: "Management fee must be between 0 and 100%." };
  const email = String(fd.get("email") ?? "").trim().slice(0, 200) || null;
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 1000) || null;

  const supabase = await createClient();
  const values = { name, email, management_fee_pct: fee, notes };
  const { error } = ownerId
    ? await supabase.from("an_owners").update(values).eq("id", ownerId).eq("workspace_id", ws.workspace.id)
    : await supabase.from("an_owners").insert({ ...values, workspace_id: ws.workspace.id });
  if (error) return { error: error.message };
  revalidatePath("/analytics", "layout");
  return { error: null, ok: true };
}

export async function deleteOwner(ownerId: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("an_owners").delete().eq("id", ownerId).eq("workspace_id", ws.workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
}
