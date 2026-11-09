"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

/** Reloads the dashboard's numbers from the database without a full page reload. */
export function RefreshButton({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const time = new Date(loadedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
  return (
    <>
      <button
        type="button"
        className="btn refresh"
        disabled={pending}
        onClick={() => start(() => router.refresh())}
        title="Load the latest uploads, direct bookings and expenses"
      >
        <RotateCw aria-hidden className={pending ? "spin" : undefined} size={14} />
        {pending ? "Refreshing…" : "Refresh"}
      </button>
      <span className="updated" aria-live="polite">
        {pending ? "Updating…" : `Updated ${time}`}
      </span>
    </>
  );
}
