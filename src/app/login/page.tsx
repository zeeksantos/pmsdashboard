import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-foreground">PMS Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Sign in to continue</p>

        {isSupabaseConfigured ? (
          <LoginForm />
        ) : (
          <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Supabase isn&apos;t configured yet. Add{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono">.env.local</code>, apply the migrations in{" "}
            <code className="font-mono">supabase/migrations/</code>, then create a user in
            the Supabase dashboard to sign in.
          </div>
        )}
      </div>
    </div>
  );
}
