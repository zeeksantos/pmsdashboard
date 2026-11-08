"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface LicenseFormState {
  error: string | null;
  message?: string;
}

export async function recordLicense(workspaceId: string, _prev: LicenseFormState, fd: FormData): Promise<LicenseFormState> {
  const kind = String(fd.get("kind") ?? "");
  if (!["activated", "renewed", "trial_extended"].includes(kind)) return { error: "Pick what you're recording." };
  const years = Math.max(0, Math.floor(Number(fd.get("years") ?? 0)) || 0);
  const days = Math.max(0, Math.floor(Number(fd.get("days") ?? 0)) || 0);
  if (kind !== "trial_extended" && years === 0 && days === 0) return { error: "Add at least a year or some days." };
  if (kind === "trial_extended" && days === 0) return { error: "Enter how many days to extend the trial." };
  const amountRaw = String(fd.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) return { error: "Amount must be a positive number." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;

  // The database function checks the caller is a platform admin.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("an_record_license", {
    p_workspace: workspaceId,
    p_kind: kind as "activated" | "renewed" | "trial_extended",
    p_years: kind === "trial_extended" ? 0 : years,
    p_days: days,
    p_amount: amount,
    p_note: note,
  });
  if (error) return { error: error.message };
  revalidatePath("/analytics/admin");
  return { error: null, message: `Saved — access now runs to ${data}.` };
}
