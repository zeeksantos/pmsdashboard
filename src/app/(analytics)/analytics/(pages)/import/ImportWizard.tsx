"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp } from "lucide-react";
import {
  CHANNEL_LABELS,
  FIELD_LABELS,
  STAY_MAPPING_FIELDS,
  foreignCurrencies,
  parseExport,
  type Channel,
  type ColumnMapping,
  type FieldKey,
} from "@/lib/analytics/importers";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/analytics/ui";
import { importExport, type ImportResult } from "./actions";

const AIRBNB_MAPPING_FIELDS: FieldKey[] = ["date", "type", "code", "checkIn", "checkOut", "listing", "guest", "amount", "paidOut", "currency"];

export function ImportWizard({ baseCurrency }: { baseCurrency: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultListing, setDefaultListing] = useState("");
  const [fx, setFx] = useState<Record<string, string>>({});
  const [result, action, pending] = useActionState<ImportResult, FormData>(importExport, { error: null });
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const preview = useMemo(() => {
    if (!text) return null;
    return parseExport(text, {
      channel: channel || undefined,
      mapping,
      defaultListing: defaultListing || undefined,
      defaultCurrency: baseCurrency,
    });
  }, [text, channel, mapping, defaultListing, baseCurrency]);

  const foreign = preview?.ok ? foreignCurrencies(preview, baseCurrency) : [];
  const needsMapping = preview && !preview.ok && preview.headers.length > 0;
  const mappingFields = (channel || preview?.channel) === "airbnb" ? AIRBNB_MAPPING_FIELDS : STAY_MAPPING_FIELDS;
  const fxReady = foreign.every((c) => Number(fx[c]) > 0);

  async function pick(f: File | null) {
    setFile(f);
    setChannel("");
    setMapping({});
    setFx({});
    setText(f ? await f.text() : "");
  }

  function reset() {
    void pick(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (result.done) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-5">
        <div className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 className="h-5 w-5" /> {result.channel} {result.pending ? "upcoming bookings" : "export"} imported
        </div>
        <ul className="mt-3 space-y-1 text-sm text-foreground">
          {result.pending ? (
            <>
              <li>{result.inserted} upcoming bookings saved — they show on the Upcoming tab, not in your earnings</li>
              {!!result.alreadyPaid && <li>{result.alreadyPaid} already paid out, so they&apos;re left in your earnings instead</li>}
            </>
          ) : (
            <>
              <li>{result.inserted} new rows added</li>
              {!!result.replaced && <li>{result.replaced} upcoming bookings have now paid out and moved into your earnings</li>}
            </>
          )}
          {!!result.updated && <li>{result.updated} existing bookings updated with the latest amounts</li>}
          {!!result.duplicates && <li>{result.duplicates} rows were already imported and skipped</li>}
          {!!result.skipped && !result.pending && <li>{result.skipped} rows ignored (cancelled, blank or unreadable)</li>}
          {!!result.newListings && <li>{result.newListings} new listings found</li>}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.unmappedListings ? (
            <Link href="/analytics/units" className={primaryButton}>
              Link {result.unmappedListings} listing{result.unmappedListings === 1 ? "" : "s"} to units
            </Link>
          ) : (
            <Link href={result.pending ? "/analytics?tab=upcoming" : "/analytics"} className={primaryButton}>
              {result.pending ? "See upcoming bookings" : "See your dashboard"}
            </Link>
          )}
          <button type="button" onClick={() => window.location.reload()} className={secondaryButton}>
            Upload another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        if (file) fd.set("file", file);
        fd.set("channel", channel || preview?.channel || "");
        fd.set("mapping", JSON.stringify(mapping));
        fd.set("defaultListing", defaultListing);
        fd.set("fx", JSON.stringify(Object.fromEntries(foreign.map((c) => [c, Number(fx[c])]))));
        action(fd);
      }}
      className="flex flex-col gap-5"
    >
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void pick(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-surface px-4 py-8 text-center hover:border-accent ${
          dragging ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <FileUp className="h-6 w-6 text-muted" />
        <span className="text-sm font-medium text-foreground">{file ? file.name : "Choose a CSV export, or drag it here"}</span>
        <span className="text-xs text-muted">Airbnb, Booking.com, Agoda, or any CSV with one row per booking · up to 8 MB</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => void pick(e.target.files?.[0] ?? null)}
        />
      </label>

      {preview && needsMapping && (
        <div className="flex flex-col gap-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-warning">{preview.error}</p>
          <Field label="Which channel is this from?">
            <select
              value={channel || preview.channel || ""}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {(Object.keys(CHANNEL_LABELS) as (Channel | "direct")[]).filter((c): c is Channel => c !== "direct").map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {(channel || preview.channel) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {mappingFields.map((f) => (
                  <Field key={f} label={FIELD_LABELS[f]}>
                    <select
                      value={mapping[f] ?? preview.mapping[f] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}
                      className={inputClass}
                    >
                      <option value="">— not in this file —</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <Field label="Listing name for every row" hint="Used when the file has no listing / room column.">
                <input value={defaultListing} onChange={(e) => setDefaultListing(e.target.value)} className={inputClass} placeholder="e.g. Seaside Studio" />
              </Field>
            </>
          )}
        </div>
      )}

      {preview && !preview.ok && !needsMapping && <p className="text-sm text-danger">{preview.error}</p>}

      {preview?.ok && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="font-medium text-foreground">
            {CHANNEL_LABELS[preview.channel!]} export · {preview.rows.length.toLocaleString()} rows
            {preview.periodStart && (
              <span className="font-normal text-muted">
                {" "}
                · {preview.periodStart} to {preview.periodEnd}
              </span>
            )}
          </div>
          {preview.pending && (
            <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-foreground">
              This is Airbnb&apos;s <b>pending</b> export: bookings that haven&apos;t paid out yet. They&apos;ll show on the Upcoming tab and
              stay out of your earnings until you upload the Transaction history that includes their payout. Uploading it replaces your
              previous upcoming list for these listings.
            </p>
          )}
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              {preview.listings.length} listing{preview.listings.length === 1 ? "" : "s"}:{" "}
              <span className="text-foreground">{preview.listings.slice(0, 4).join(" · ")}</span>
              {preview.listings.length > 4 && ` and ${preview.listings.length - 4} more`}
            </li>
            {preview.skipped.map((s) => (
              <li key={s.reason}>
                {s.count} row{s.count === 1 ? "" : "s"} will be ignored: {s.reason.toLowerCase()}
              </li>
            ))}
            <li>Rows already imported from an earlier upload are detected and skipped automatically.</li>
          </ul>
          {preview.warnings.map((w) => (
            <p key={w} className="mt-2 text-warning">
              {w}
            </p>
          ))}
          {foreign.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {foreign.map((c) => (
                <Field
                  key={c}
                  label={`Exchange rate: 1 ${c} = ? ${baseCurrency}`}
                  hint={`${preview.currencies[c]} row${preview.currencies[c] === 1 ? " is" : "s are"} in ${c}. Use the rate you were actually paid at.`}
                >
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={fx[c] ?? ""}
                    onChange={(e) => setFx((x) => ({ ...x, [c]: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      )}

      {result.error && <p className="text-sm text-danger">{result.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={!preview?.ok || !fxReady || pending} className={primaryButton}>
          {pending ? "Importing…" : "Import"}
        </button>
        {!file && <span className="self-center text-sm text-muted">Choose a file first.</span>}
        {file && (
          <button type="button" onClick={reset} className={secondaryButton} disabled={pending}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
