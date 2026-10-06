"use client";

import { useActionState, useState } from "react";
import { changeRole, resetPassword } from "./actions";
import { allRoles, roleLabels, type Role } from "@/lib/roles";
import { generatePassword } from "@/lib/password";
import { formatDateTime } from "@/lib/format";

const input =
  "rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent";

export type LoginRow = {
  user_id: string;
  email: string;
  role: Role;
  last_sign_in_at: string | null;
  employee_name: string | null;
};

export function UserRow({
  row, isSelf, isOwner,
}: { row: LoginRow; isSelf: boolean; isOwner: boolean }) {
  const [roleState, roleAction, savingRole] = useActionState(changeRole, null);
  const [pwState, pwAction, savingPw] = useActionState(resetPassword, null);
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const locked = isSelf || (row.role === "owner" && !isOwner);

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.email}
            {isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
          </p>
          <p className="text-xs text-muted">
            {row.employee_name ?? "Not linked to an employee"} ·{" "}
            {row.last_sign_in_at ? `Last sign-in ${formatDateTime(row.last_sign_in_at)}` : "Never signed in"}
          </p>
        </div>
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="email" value={row.email} />
          <select name="role" defaultValue={row.role} disabled={locked} aria-label={`Access level for ${row.email}`} className={input}>
            {allRoles
              .filter((r) => isOwner || r !== "owner" || r === row.role)
              .map((r) => (<option key={r} value={r}>{roleLabels[r]}</option>))}
          </select>
          <button disabled={locked || savingRole} className="rounded-lg bg-surface-raised px-3 py-1.5 text-sm hover:bg-border disabled:opacity-50">
            {savingRole ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
      {roleState && <p className={`mt-2 text-sm ${roleState.ok ? "text-success" : "text-danger"}`}>{roleState.message}</p>}

      {!locked && (
        <div className="mt-3">
          {!showPw ? (
            <button type="button" onClick={() => setShowPw(true)} className="text-xs text-accent hover:underline">
              Set a new password
            </button>
          ) : (
            <form action={pwAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="user_id" value={row.user_id} />
              <input name="password" type="text" required minLength={8} autoComplete="off" value={pw}
                onChange={(e) => setPw(e.target.value)} placeholder="New password" className={`${input} w-56`} />
              <button type="button" onClick={() => setPw(generatePassword())} className="rounded-lg bg-surface-raised px-3 py-1.5 text-sm hover:bg-border">
                Generate
              </button>
              <button disabled={savingPw} className="rounded-lg bg-surface-raised px-3 py-1.5 text-sm hover:bg-border disabled:opacity-50">
                {savingPw ? "Saving…" : "Set password"}
              </button>
            </form>
          )}
          {pwState && <p className={`mt-2 text-sm ${pwState.ok ? "text-success" : "text-danger"}`}>{pwState.message}</p>}
        </div>
      )}
    </li>
  );
}
