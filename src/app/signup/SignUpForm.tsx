"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type SignUpState } from "./actions";

const input =
  "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, { error: null });

  if (state.checkEmail) {
    return (
      <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
        Check <strong>{state.checkEmail}</strong> for a confirmation link, then sign in to start your trial.
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      {(
        [
          ["full_name", "Your name", "text", "name"],
          ["email", "E-mail", "email", "email"],
          ["password", "Password (8+ characters)", "password", "new-password"],
        ] as const
      ).map(([name, label, type, autoComplete]) => (
        <div key={name} className="flex flex-col gap-1.5">
          <label htmlFor={name} className="text-sm font-medium text-foreground">
            {label}
          </label>
          <input id={name} name={name} type={type} required autoComplete={autoComplete} minLength={name === "password" ? 8 : undefined} className={input} />
        </div>
      ))}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <Link href="/login" className="text-center text-sm text-muted hover:text-foreground">
        Already have an account? Sign in
      </Link>
    </form>
  );
}
