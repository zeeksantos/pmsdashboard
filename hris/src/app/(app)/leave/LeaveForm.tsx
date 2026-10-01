"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestLeave } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { formatDays } from "@/lib/leave";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function LeaveForm({ types, today }: { types: { id: string; name: string }[]; today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [half, setHalf] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [error, action, pending] = useActionState(async (prev: string | null, fd: FormData) => {
    const result = await requestLeave(prev, fd);
    if (!result) {
      formRef.current?.reset();
      setStart(today);
      setEnd("");
      setHalf(false);
    }
    return result;
  }, null);

  // Live count of the working days this request would use.
  useEffect(() => {
    if (!start) return;
    let cancelled = false;
    createClient()
      .rpc("preview_leave_days", { p_start: start, p_end: end || start, p_half: half })
      .then(({ data, error: e }) => {
        if (cancelled) return;
        setPreview(e ? e.message : formatDays(Number(data)));
      });
    return () => {
      cancelled = true;
    };
  }, [start, end, half]);

  const previewIsError = preview !== null && !/^\d/.test(preview);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm text-muted">Leave type</label>
        <select name="leave_type_id" required className={input}>
          {types.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="half_day" checked={half} onChange={(e) => setHalf(e.target.checked)} />
          Half day (single date)
        </label>
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">From</label>
        <input
          name="start_date" type="date" required value={start}
          onChange={(e) => setStart(e.target.value)} className={input}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">To (leave blank for one day)</label>
        <input
          name="end_date" type="date" value={end} min={start} disabled={half}
          onChange={(e) => setEnd(e.target.value)} className={input}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm text-muted">Reason (optional)</label>
        <input name="reason" className={input} />
      </div>
      <div className="sm:col-span-2">
        <p className={`mb-3 text-sm ${previewIsError ? "text-danger" : "text-muted"}`}>
          {start && preview ? (previewIsError ? preview : `This will use ${preview} of your scheduled working days.`) : ""}
        </p>
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Request leave"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}
