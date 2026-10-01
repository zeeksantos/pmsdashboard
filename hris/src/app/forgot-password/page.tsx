import { isSupabaseConfigured } from "@/lib/env";
import { ForgotPasswordFlow } from "./ForgotPasswordFlow";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">We&apos;ll email you a one-time code.</p>

        {isSupabaseConfigured ? (
          <ForgotPasswordFlow />
        ) : (
          <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Supabase isn&apos;t configured yet.
          </div>
        )}
      </div>
    </div>
  );
}
