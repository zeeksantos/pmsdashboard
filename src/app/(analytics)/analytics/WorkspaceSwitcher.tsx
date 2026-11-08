"use client";

import { useTransition } from "react";
import { switchWorkspace } from "./actions";

export function WorkspaceSwitcher({
  current,
  options,
}: {
  current: string;
  options: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      aria-label="Switch workspace"
      value={current}
      disabled={isPending}
      onChange={(e) => startTransition(() => switchWorkspace(e.target.value))}
      className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
