"use client";

import { useActionState, useRef, useState } from "react";
import { createUser } from "./actions";
import { allRoles, roleLabels, type Role } from "@/lib/roles";
import { generatePassword } from "@/lib/password";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function CreateUserForm({
  isOwner,
  employees,
}: {
  isOwner: boolean;
  employees: { id: string; full_name: string; employee_no: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: Parameters<typeof createUser>[0], fd: FormData) => {
      const result = await createUser(prev, fd);
      if (result?.ok) {
        formRef.current?.reset();
        setPassword("");
      }
      return result;
    },
    null
  );

  return (
    <form ref={formRef} action={action} className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">Add a user</h2>
      <p className="mt-1 text-sm text-muted">
        Creates a login right here. They sign in with this email and password and can change the password
        under Settings.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm text-muted">Email</label>
          <input name="email" type="email" required autoComplete="off" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Temporary password (min. 8 characters)</label>
          <div className="flex gap-2">
            <input
              name="password" type="text" required minLength={8} autoComplete="off"
              value={password} onChange={(e) => setPassword(e.target.value)} className={input}
            />
            <button type="button" onClick={() => setPassword(generatePassword())}
              className="shrink-0 rounded-lg bg-surface-raised px-3 py-2 text-sm hover:bg-border">
              Generate
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Access level</label>
          <select name="role" defaultValue="employee" className={input}>
            {allRoles
              .filter((r) => isOwner || r !== "owner")
              .map((r: Role) => (<option key={r} value={r}>{roleLabels[r]}</option>))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Link to employee record (optional)</label>
          <select name="employee_id" defaultValue="" className={input}>
            <option value="">Not linked</option>
            {employees.map((e) => (<option key={e.id} value={e.id}>{e.full_name} · {e.employee_no}</option>))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
          {pending ? "Creating…" : "Create user"}
        </button>
        {state && <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>}
      </div>
    </form>
  );
}
