import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageUsers } from "@/lib/roles";
import { CreateUserForm } from "./CreateUserForm";
import { UserRow, type LoginRow } from "./UserRow";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me.role)) notFound();

  const supabase = await createClient();
  const [loginsRes, employeesRes] = await Promise.all([
    supabase.rpc("list_logins"),
    supabase.from("employees").select("id, full_name, employee_no").is("user_id", null).eq("status", "ACTIVE").order("full_name"),
  ]);
  const logins = (loginsRes.data ?? []) as LoginRow[];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Create logins and choose what each person can access. Only an owner can create or change an owner.
        </p>
      </div>

      <CreateUserForm isOwner={me.role === "owner"} employees={employeesRes.data ?? []} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">All users ({logins.length})</h2>
        {loginsRes.error && <p className="mb-3 text-sm text-danger">{loginsRes.error.message}</p>}
        <ul className="space-y-3">
          {logins.map((l) => (
            <UserRow key={l.user_id} row={l} isSelf={l.user_id === me.userId} isOwner={me.role === "owner"} />
          ))}
        </ul>
      </section>
    </div>
  );
}
