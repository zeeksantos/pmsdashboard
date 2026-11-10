"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/analytics/workspace";
import type { WorkspaceRole } from "@/lib/database.types";

export interface SettingsState {
  error: string | null;
  ok?: boolean;
  message?: string;
}

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function requireOwner() {
  const ws = await requireWorkspace();
  if (!ws.isOwner) throw new Error("Only the workspace owner can change settings.");
  return ws;
}

export async function saveBranding(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  let ws;
  try {
    ws = await requireOwner();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Business name is required." };
  const kind = String(fd.get("kind") ?? "host");
  if (kind !== "host" && kind !== "manager") return { error: "Pick a workspace type." };
  const color = String(fd.get("brand_color") ?? "").trim();
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Brand colour must be a hex colour like #1D4ED8." };

  const supabase = await createClient();
  let logoPath = ws.workspace.brand_logo_path;
  const oldLogo = logoPath;
  const logo = fd.get("logo");
  if (fd.get("remove_logo") === "on") logoPath = null;
  if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_TYPES[logo.type];
    if (!ext) return { error: "Upload the logo as PNG, JPG, WebP or SVG." };
    if (logo.size > 2 * 1024 * 1024) return { error: "Logos can be up to 2 MB." };
    logoPath = `${ws.workspace.id}/logo-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("an-branding").upload(logoPath, logo, { contentType: logo.type });
    if (error) return { error: `Logo upload failed: ${error.message}` };
  }

  const { error } = await supabase
    .from("workspaces")
    .update({
      name,
      kind,
      brand_name: String(fd.get("brand_name") ?? "").trim().slice(0, 80) || null,
      brand_color: color || null,
      brand_logo_path: logoPath,
      statement_footer: String(fd.get("statement_footer") ?? "").trim().slice(0, 1000) || null,
    })
    .eq("id", ws.workspace.id);
  if (error) return { error: error.message };
  if (oldLogo && oldLogo !== logoPath) await supabase.storage.from("an-branding").remove([oldLogo]);

  revalidatePath("/analytics", "layout");
  return { error: null, ok: true, message: "Saved." };
}

export async function inviteMember(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  let ws;
  try {
    ws = await requireOwner();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role") ?? "viewer") as WorkspaceRole;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid e-mail address." };
  if (!["owner", "editor", "viewer"].includes(role)) return { error: "Pick a role." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_invites")
    .upsert({ workspace_id: ws.workspace.id, email, role, invited_by: ws.userId }, { onConflict: "workspace_id,email" });
  if (error) return { error: error.message };
  revalidatePath("/analytics/settings");
  return {
    error: null,
    ok: true,
    message: `Invited ${email}. They join automatically when they sign up or log in with that e-mail.`,
  };
}

export async function revokeInvite(inviteId: string) {
  const ws = await requireOwner();
  const supabase = await createClient();
  await supabase.from("workspace_invites").delete().eq("id", inviteId).eq("workspace_id", ws.workspace.id);
  revalidatePath("/analytics/settings");
}

export async function setMemberRole(userId: string, role: WorkspaceRole) {
  const ws = await requireOwner();
  if (!["owner", "editor", "viewer"].includes(role)) throw new Error("Invalid role.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", ws.workspace.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics/settings");
}

export async function removeMember(userId: string) {
  const ws = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ws.workspace.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics/settings");
}
