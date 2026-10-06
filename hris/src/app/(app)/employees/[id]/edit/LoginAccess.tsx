"use client";

import Link from "next/link";
import { useActionState } from "react";
import { linkLogin, setRole } from "../../actions";
import { allRoles, roleLabels } from "@/lib/roles";

const input =
  "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function LoginAccess({
  employeeId,
  linked,
  canSetRole,
  isOwner,
}: {
  employeeId: string;
  linked: boolean;
  canSetRole: boolean;
  isOwner: boolean;
}) {
  const [linkMsg, linkAction, linking] = useActionState(linkLogin, null);
  const [roleMsg, roleAction, saving] = useActionState(setRole, null);

  return (
    <section className="max-w-4xl rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">Login access</h2>
      <p className="mt-1 text-sm text-muted">
        Create logins on the <Link href="/users" className="text-accent hover:underline">Users</Link> page, then
        link one here by email. Status: {linked ? "linked" : "not linked"}.
      </p>

      <form action={linkAction} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="employee_id" value={employeeId} />
        <input name="email" type="email" required placeholder="Login email" className={`${input} w-64`} />
        <button disabled={linking} className="rounded-lg bg-surface-raised px-4 py-2 text-sm hover:bg-border disabled:opacity-60">
          {linking ? "Linking…" : linked ? "Re-link login" : "Link login"}
        </button>
      </form>
      {linkMsg && <p className="mt-2 text-sm text-muted">{linkMsg}</p>}

      {canSetRole && (
        <>
          <form action={roleAction} className="mt-5 flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder="Login email" className={`${input} w-64`} />
            <select name="role" defaultValue="employee" className={input}>
              {allRoles
                .filter((r) => isOwner || r !== "owner")
                .map((r) => (<option key={r} value={r}>{roleLabels[r]}</option>))}
            </select>
            <button disabled={saving} className="rounded-lg bg-surface-raised px-4 py-2 text-sm hover:bg-border disabled:opacity-60">
              {saving ? "Saving…" : "Set role"}
            </button>
          </form>
          {roleMsg && <p className="mt-2 text-sm text-muted">{roleMsg}</p>}
        </>
      )}
    </section>
  );
}
