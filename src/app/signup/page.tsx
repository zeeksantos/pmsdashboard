import { isSupabaseConfigured } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/analytics/branding";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: `Sign up · ${PRODUCT_NAME}` };

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-foreground">{PRODUCT_NAME}</h1>
        <p className="mt-1 text-sm text-muted">
          Occupancy, nightly rates, expenses and profit for every unit — from your Airbnb, Booking.com and Agoda exports.
          14 days free.
        </p>
        {isSupabaseConfigured ? (
          <SignUpForm />
        ) : (
          <p className="mt-6 text-sm text-warning">Supabase isn&apos;t configured yet.</p>
        )}
      </div>
    </div>
  );
}
