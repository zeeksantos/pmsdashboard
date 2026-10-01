"use client";

import { useActionState } from "react";

// A small form-button that runs a server action after a confirm() prompt and shows its error.
export function ConfirmButton({
  action, fields, label, pendingLabel, confirmText, className,
}: {
  action: (prev: string | null, fd: FormData) => Promise<string | null>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  confirmText: string;
  className: string;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (<input key={k} type="hidden" name={k} value={v} />))}
      <button disabled={pending} className={className}>{pending ? pendingLabel : label}</button>
      {error && <p className="mt-1 max-w-64 text-xs text-danger">{error}</p>}
    </form>
  );
}
