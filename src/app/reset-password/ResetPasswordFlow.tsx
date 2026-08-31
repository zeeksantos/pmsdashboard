"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  confirmPasswordReset,
  type RequestResetState,
  type ConfirmResetState,
} from "./actions";

const requestInitial: RequestResetState = { error: null, success: false };
const confirmInitial: ConfirmResetState = { error: null };

export function ResetPasswordFlow() {
  const [email, setEmail] = useState("");
  const [requestState, requestAction, isRequesting] = useActionState(
    requestPasswordReset,
    requestInitial
  );
  const [confirmState, confirmAction, isConfirming] = useActionState(
    confirmPasswordReset,
    confirmInitial
  );

  if (!requestState.success) {
    return (
      <form action={requestAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>

        {requestState.error && <p className="text-sm text-danger">{requestState.error}</p>}

        <button
          type="submit"
          disabled={isRequesting}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {isRequesting ? "Sending…" : "Send reset code"}
        </button>

        <Link href="/login" className="text-center text-sm text-muted hover:text-foreground">
          Back to sign in
        </Link>
      </form>
    );
  }

  return (
    <form action={confirmAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />

      <p className="text-sm text-muted">
        Code sent to <span className="text-foreground">{email}</span>. Use the numeric code
        printed in the email body — not the link, which can get invalidated by email link
        scanners before you click it.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="token" className="text-sm font-medium text-foreground">
          Code
        </label>
        <input
          id="token"
          name="token"
          type="text"
          required
          autoComplete="one-time-code"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </div>

      {confirmState.error && <p className="text-sm text-danger">{confirmState.error}</p>}

      <button
        type="submit"
        disabled={isConfirming}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {isConfirming ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
