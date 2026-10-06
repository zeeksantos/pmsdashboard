"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";

type Log = {
  time_in: string | null;
  time_out: string | null;
  late_minutes: number;
  work_mode: string;
  field_note: string | null;
} | null;

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
  const [mode, setMode] = useState<"OFFICE" | "FIELD">("OFFICE");
  const [note, setNote] = useState("");

  const action = log?.time_in ? (log.time_out ? null : "clock_out") : "clock_in";

  async function run(fn: "clock_in" | "clock_out") {
    if (fn === "clock_in" && mode === "FIELD" && !note.trim()) {
      setError("Say where you are working and why.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pos = await getPosition();
      const supabase = createClient();
      const coords = { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy };
      const { error: rpcError } =
        fn === "clock_in"
          ? await supabase.rpc("clock_in_with_mode", { ...coords, p_mode: mode, p_note: mode === "FIELD" ? note.trim() : null })
          : await supabase.rpc("clock_out", coords);
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

      {log?.time_in && (
        <p className="text-sm">
          <span className={log.work_mode === "FIELD" ? "rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent" : "rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted"}>
            {log.work_mode === "FIELD" ? "Field / out of office" : "Office"}
          </span>
          {log.work_mode === "FIELD" && log.field_note && <span className="ml-2 text-muted">{log.field_note}</span>}
        </p>
      )}

      {action === "clock_in" && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm text-muted">Where are you working today?</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["OFFICE", "Office"], ["FIELD", "Field / out of office"]] as const).map(([value, text]) => (
              <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${mode === value ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"}`}>
                <input type="radio" name="work_mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                {text}
              </label>
            ))}
          </div>
          {mode === "FIELD" && (
            <div>
              <label htmlFor="field-note" className="mb-1.5 block text-sm text-muted">Where and why? *</label>
              <textarea
                id="field-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2}
                placeholder="e.g. Client meeting in Makati, on-site shoot in Pasig"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
          )}
        </fieldset>
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
