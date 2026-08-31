"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface GuestFormState {
  error: string | null;
}

function parseGuestForm(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const id_type = String(formData.get("id_type") ?? "").trim();
  const id_number = String(formData.get("id_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!full_name) return { error: "Full name is required." } as const;

  return {
    error: null,
    values: {
      full_name,
      email: email || null,
      phone: phone || null,
      id_type: id_type || null,
      id_number: id_number || null,
      notes: notes || null,
    },
  } as const;
}

export async function createGuest(_prevState: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const parsed = parseGuestForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("guests").insert(parsed.values);
  if (error) return { error: error.message };

  revalidatePath("/guests");
  return { error: null };
}

export async function updateGuest(
  guestId: string,
  _prevState: GuestFormState,
  formData: FormData
): Promise<GuestFormState> {
  const parsed = parseGuestForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("guests").update(parsed.values).eq("id", guestId);
  if (error) return { error: error.message };

  revalidatePath("/guests");
  revalidatePath(`/guests/${guestId}`);
  return { error: null };
}

export async function deleteGuest(guestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("guests").delete().eq("id", guestId);
  if (error) throw new Error(error.message);
  revalidatePath("/guests");
}
