"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { iconButton } from "./ui";

/** Icon button that confirms, then runs a (bound) server action. */
export function ConfirmButton({
  action,
  confirmText,
  label,
  children,
  className,
}: {
  action: () => Promise<void>;
  confirmText: string;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      className={className ?? iconButton}
      onClick={() => {
        if (confirm(confirmText)) start(() => action());
      }}
    >
      {children ?? <Trash2 className="h-4 w-4" />}
    </button>
  );
}
