import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { navForRole } from "@/lib/nav";
import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@/components/SignOutButton";

// Every route under this layout needs the signed-in user's session and role,
// so none of them can be statically prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Supabase isn&apos;t configured yet. Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="font-mono">.env.local</code> and apply the migrations in{" "}
          <code className="font-mono">supabase/migrations/</code>.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Signed in, but no profile row exists for this user yet. The
          on_auth_user_created trigger (supabase/migrations/0005) should have created one
          automatically — check it ran, or insert a profiles row for this user manually.
        </div>
      </div>
    );
  }

  return (
    <AppShell
      items={navForRole(profile.role)}
      userLabel={`${profile.full_name} · ${profile.role.replace("_", " ")}`}
      signOutButton={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
