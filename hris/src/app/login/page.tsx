import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <Logo size={56} className="border border-border" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Z-Fast HRIS</h1>
        <p className="mt-1 text-sm text-muted">Sign in to continue</p>

        {isSupabaseConfigured ? (
          <LoginForm />
        ) : (
          <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Supabase isn&apos;t configured yet. Copy <code className="font-mono">.env.local.example</code>{" "}
            to <code className="font-mono">.env.local</code> and fill in your project URL and anon key.
          </div>
        )}
      </div>
    </div>
  );
}
