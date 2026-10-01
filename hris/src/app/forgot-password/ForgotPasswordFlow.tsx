"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmReset, requestReset, type RequestState } from "./actions";

const input =
  "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";
const button =
  "mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60";

export function ForgotPasswordFlow() {
  const [request, requestAction, requesting] = useActionState<RequestState, FormData>(requestReset, {
    error: null,
    email: null,
  });
  const [confirmError, confirmAction, confirming] = useActionState(confirmReset, null);

  if (!request.email) {
    return (
      <form action={requestAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={input} />
        </div>
        {request.error && <p className="text-sm text-danger">{request.error}</p>}
        <button disabled={requesting} className={button}>
          {requesting ? "Sending…" : "Send me a code"}
        </button>
        <Link href="/login" className="text-center text-sm text-muted hover:text-foreground">Back to sign in</Link>
      </form>
    );
  }

  return (
    <form action={confirmAction} className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-muted">
        If <span className="text-foreground">{request.email}</span> has an account, we&apos;ve emailed a
        code. It can take a minute to arrive. Check spam too.
      </p>
      <input type="hidden" name="email" value={request.email} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium">Code from the email</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </div>
      {confirmError && <p className="text-sm text-danger">{confirmError}</p>}
      <button disabled={confirming} className={button}>
        {confirming ? "Resetting…" : "Reset password"}
      </button>
      <Link href="/forgot-password" className="text-center text-sm text-muted hover:text-foreground">
        Start over
      </Link>
    </form>
  );
}
