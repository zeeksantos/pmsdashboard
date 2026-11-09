"use client";

import { useActionState, useTransition } from "react";
import type { WorkspaceInvite, WorkspaceMemberListRow, WorkspaceRole } from "@/lib/database.types";
import { ConfirmButton } from "@/components/analytics/ConfirmButton";
import { inputClass, primaryButton } from "@/components/analytics/ui";
import { inviteMember, removeMember, revokeInvite, setMemberRole, type SettingsState } from "./actions";

const ROLE_HELP: Record<WorkspaceRole, string> = {
  owner: "Everything, incl. settings & members",
  editor: "Upload exports, edit units & expenses",
  viewer: "View only (e.g. a business partner)",
};

function RoleSelect({ userId, role }: { userId: string; role: WorkspaceRole }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Role"
      defaultValue={role}
      disabled={pending}
      onChange={(e) => start(() => setMemberRole(userId, e.target.value as WorkspaceRole))}
      className={`${inputClass} w-auto py-1`}
    >
      {(["owner", "editor", "viewer"] as const).map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

export function Members({
  members,
  invites,
  me,
  isOwner,
}: {
  members: WorkspaceMemberListRow[];
  invites: WorkspaceInvite[];
  me: string;
  isOwner: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(inviteMember, { error: null });
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-border text-sm">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="truncate text-foreground">
                {m.full_name && m.full_name !== m.email ? `${m.full_name} · ` : ""}
                {m.email}
                {m.user_id === me && <span className="text-muted"> (you)</span>}
              </div>
              <div className="text-xs text-muted">{ROLE_HELP[m.role]}</div>
            </div>
            {isOwner && m.user_id !== me ? (
              <span className="flex items-center gap-1">
                <RoleSelect userId={m.user_id} role={m.role} />
                <ConfirmButton
                  action={removeMember.bind(null, m.user_id)}
                  label={`Remove ${m.email}`}
                  confirmText={`Remove ${m.email} from this workspace?`}
                />
              </span>
            ) : (
              <span className="text-xs capitalize text-muted">{m.role}</span>
            )}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-2">
            <div>
              <div className="text-foreground">{i.email}</div>
              <div className="text-xs text-muted">Invited as {i.role} · joins when they sign in</div>
            </div>
            {isOwner && (
              <ConfirmButton action={revokeInvite.bind(null, i.id)} label={`Cancel invite for ${i.email}`} confirmText={`Cancel the invite for ${i.email}?`} />
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form action={action} className="flex flex-col gap-2 sm:flex-row">
          <input type="email" name="email" required placeholder="partner@email.com" aria-label="E-mail to invite" className={inputClass} />
          <select name="role" defaultValue="viewer" aria-label="Role" className={`${inputClass} sm:w-36`}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
          <button type="submit" disabled={pending} className={primaryButton}>
            Invite
          </button>
        </form>
      )}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && <p className="text-sm text-success">{state.message}</p>}
    </div>
  );
}
