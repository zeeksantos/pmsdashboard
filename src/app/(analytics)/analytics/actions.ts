"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/analytics/workspace";
import type { WorkspaceKind } from "@/lib/database.types";

export interface FormState {
  error: string | null;
  ok?: boolean;
  message?: string;
}

export async function createWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "host") as WorkspaceKind;
  if (!name) return { error: "Give your business a name." };
  if (kind !== "host" && kind !== "manager") return { error: "Pick how you run your rentals." };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("an_create_workspace", { p_name: name, p_kind: kind });
  if (error) return { error: error.message };

  (await cookies()).set(WORKSPACE_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/analytics", "layout");
  redirect("/analytics/import");
}

export async function switchWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("You're not a member of that workspace.");

  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/analytics", "layout");
  redirect("/analytics");
}
