"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function saveContact(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_contact", {
    p_nickname: s(fd, "nickname"),
    p_phone: s(fd, "phone"),
    p_personal_email: s(fd, "personal_email"),
    p_present_address: s(fd, "present_address"),
    p_city: s(fd, "city"),
    p_province: s(fd, "province"),
    p_emergency_contact_name: s(fd, "emergency_contact_name"),
    p_emergency_contact_relationship: s(fd, "emergency_contact_relationship"),
    p_emergency_contact_number: s(fd, "emergency_contact_number"),
  });
  if (error) return error.message;
  revalidatePath("/account");
  revalidatePath("/employees");
  return "Saved.";
}
