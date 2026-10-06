"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageUsers } from "@/lib/roles";

export type UserActionState = { ok: boolean; message: string } | null;

async function guard() {
  const me = await getCurrentUser();
  return me && canManageUsers(me.role) ? me : null;
}

export async function createUser(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  if (!(await guard())) return { ok: false, message: "Not allowed." };
  const email = String(fd.get("email") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_user", {
    p_email: email,
    p_password: String(fd.get("password") ?? ""),
    p_role: String(fd.get("role") ?? "employee"),
    p_employee: String(fd.get("employee_id") ?? "") || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/users");
  revalidatePath("/employees");
  return { ok: true, message: `Created ${email.toLowerCase()}. Share the email and password with them privately.` };
}

export async function changeRole(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  if (!(await guard())) return { ok: false, message: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_email: String(fd.get("email") ?? ""),
    p_role: String(fd.get("role") ?? ""),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/users");
  return { ok: true, message: "Role updated." };
}

export async function resetPassword(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  if (!(await guard())) return { ok: false, message: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_password", {
    p_user: String(fd.get("user_id") ?? ""),
    p_password: String(fd.get("password") ?? ""),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password changed. Share it with them privately." };
}
