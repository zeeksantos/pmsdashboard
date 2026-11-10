import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./NewPasswordForm";

// Reached from the reset e-mail's link (signed in by /auth/callback), or by
// anyone signed in who wants to change their password.
export default async function NewPasswordPage() {
  await connection(); // per-request: depends on who is signed in
  if (!isSupabaseConfigured) redirect("/reset-password");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/reset-password");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">
          For <span className="text-foreground">{data.user.email}</span>
        </p>
        <NewPasswordForm />
      </div>
    </div>
  );
}
