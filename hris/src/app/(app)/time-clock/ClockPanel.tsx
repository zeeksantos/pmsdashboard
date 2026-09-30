"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";

type Log = { time_in: string | null; time_out: string | null; late_minutes: number } | null;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser doesn't support location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () =>
      reject(new Error("Location is required. Allow location access and try again.")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export function ClockPanel({ log }: { log: Log }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const action = log?.time_in ? (log.time_out ? null : "clock_out") : "clock_in";

  async function run(fn: "clock_in" | "clock_out") {
    setBusy(true);
    setError(null);
    try {
      const pos = await getPosition();
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc(fn, {
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
        p_accuracy: pos.coords.accuracy,
      });
      if (rpcError) throw new Error(rpcError.message);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted">Time in</dt>
          <dd className="mt-1 text-lg font-medium">{formatTime(log?.time_in ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted">Time out</dt>
          <dd className="mt-1 text-lg font-medium">{formatTime(log?.time_out ?? null)}</dd>
        </div>
      </dl>

      {log && log.late_minutes > 0 && (
        <p className="text-sm text-warning">Late by {log.late_minutes} min</p>
      )}

      {action ? (
        <button
          onClick={() => run(action)}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Getting location…" : action === "clock_in" ? "Time In" : "Time Out"}
        </button>
      ) : (
        <p className="text-sm text-success">You&apos;re done for today.</p>
      )}

      <p className="text-xs text-muted">Your location is recorded when you time in and out.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
