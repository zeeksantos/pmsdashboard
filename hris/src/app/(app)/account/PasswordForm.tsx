"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function PasswordForm({ email }: { email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (next.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (next !== confirm) return setMsg({ ok: false, text: "The new passwords don't match." });
    if (next === current) return setMsg({ ok: false, text: "Choose a password different from the current one." });

    setBusy(true);
    setMsg(null);
    const supabase = createClient();

    // Confirm the current password first, so a borrowed open session can't change it.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyError) {
      setBusy(false);
      return setMsg({ ok: false, text: "Your current password is incorrect." });
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });

    formRef.current?.reset();
    setMsg({ ok: true, text: "Password changed." });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-1 text-base font-semibold">Change password</h2>
      <p className="mb-4 text-sm text-muted">Signed in as {email}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm text-muted">Current password</label>
          <input name="current" type="password" required autoComplete="current-password" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">New password</label>
          <input name="next" type="password" required minLength={8} autoComplete="new-password" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Confirm new password</label>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={busy}
          className="rounded-lg bg-surface-raised px-5 py-2 text-sm hover:bg-border disabled:opacity-60"
        >
          {busy ? "Changing…" : "Change password"}
        </button>
        {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</span>}
      </div>
    </form>
  );
}
