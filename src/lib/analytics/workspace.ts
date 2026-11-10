import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceRole } from "@/lib/database.types";
import { getManilaToday } from "@/lib/calendar";

export const WORKSPACE_COOKIE = "an_ws";

export type LicenseState = "trial" | "active" | "expiring" | "expired";

export interface LicenseStatus {
  state: LicenseState;
  /** Date access ends (trial end or paid-until, whichever is later). */
  until: string;
  daysLeft: number;
  isPaid: boolean;
}

export function licenseStatus(ws: Pick<Workspace, "trial_ends_at" | "access_until">, today = getManilaToday()): LicenseStatus {
  const paidUntil = ws.access_until;
  const isPaid = Boolean(paidUntil && paidUntil >= today);
  const until = paidUntil && paidUntil > ws.trial_ends_at ? paidUntil : ws.trial_ends_at;
  const daysLeft = Math.round((Date.parse(until) - Date.parse(today)) / 86_400_000);
  let state: LicenseState;
  if (until < today) state = "expired";
  else if (!isPaid) state = "trial";
  else if (daysLeft <= 30) state = "expiring";
  else state = "active";
  return { state, until, daysLeft, isPaid };
}

export interface WorkspaceContext {
  userId: string;
  email: string | null;
  workspace: Workspace;
  role: WorkspaceRole;
  canEdit: boolean;
  isOwner: boolean;
  license: LicenseStatus;
  memberships: { workspace: Workspace; role: WorkspaceRole }[];
  isPlatformAdmin: boolean;
}

export type WorkspaceLookup =
  | { status: "signed_out" }
  | { status: "no_workspace"; userId: string; email: string | null; isPlatformAdmin: boolean }
  | ({ status: "ok" } & WorkspaceContext);

/**
 * Resolves the signed-in user's current workspace (from the an_ws cookie,
 * falling back to their first membership). Cached per request so layout and
 * page share one lookup.
 */
export const lookupWorkspace = cache(async (): Promise<WorkspaceLookup> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed_out" };

  const [{ data: memberRows }, { data: isAdmin }] = await Promise.all([
    supabase.from("workspace_members").select("workspace_id, role, created_at").eq("user_id", user.id).order("created_at"),
    supabase.rpc("an_is_platform_admin"),
  ]);
  const isPlatformAdmin = Boolean(isAdmin);

  const ids = (memberRows ?? []).map((m) => m.workspace_id);
  if (ids.length === 0) {
    return { status: "no_workspace", userId: user.id, email: user.email ?? null, isPlatformAdmin };
  }

  const { data: workspaces } = await supabase.from("workspaces").select("*").in("id", ids);
  const byId = new Map((workspaces ?? []).map((w) => [w.id, w]));
  const memberships = (memberRows ?? [])
    .filter((m) => byId.has(m.workspace_id))
    .map((m) => ({ workspace: byId.get(m.workspace_id)!, role: m.role }));
  if (memberships.length === 0) {
    return { status: "no_workspace", userId: user.id, email: user.email ?? null, isPlatformAdmin };
  }

  const cookieStore = await cookies();
  const preferred = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const current = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0];
  const license = licenseStatus(current.workspace);
  const editorRole = current.role === "owner" || current.role === "editor";

  return {
    status: "ok",
    userId: user.id,
    email: user.email ?? null,
    workspace: current.workspace,
    role: current.role,
    canEdit: editorRole && license.state !== "expired",
    isOwner: current.role === "owner",
    license,
    memberships,
    isPlatformAdmin,
  };
});

/** For pages and actions that need a workspace; redirects otherwise. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const ws = await lookupWorkspace();
  if (ws.status === "signed_out") redirect("/login");
  if (ws.status === "no_workspace") redirect("/analytics");
  return ws;
}

/**
 * For server actions that change data. RLS enforces the same rules in the
 * database; this gives a readable error instead of a policy violation.
 */
export async function requireEditableWorkspace(): Promise<WorkspaceContext> {
  const ws = await requireWorkspace();
  if (!ws.canEdit) {
    throw new Error(
      ws.license.state === "expired"
        ? "Your licence has expired — renew it to make changes. Your data is still viewable."
        : "You have view-only access to this workspace."
    );
  }
  return ws;
}
