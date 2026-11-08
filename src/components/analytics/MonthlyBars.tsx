"use client";

import { useState } from "react";

export interface BarDatum {
  label: string; // short label under the bar ("Jan")
  fullLabel: string; // tooltip / table label ("Jan 2026")
  value: number | null;
  note?: string; // extra tooltip line
  /** Incomplete month (data stops part-way): drawn faded, label gets "*". */
  partial?: boolean;
}

type Format = "money" | "percent" | "number";

function fmt(v: number | null, format: Format, currency: string): string {
  if (v == null) return "—";
  if (format === "percent") return `${Math.round(v * 100)}%`;
  if (format === "number") return v.toLocaleString("en-PH", { maximumFractionDigits: 1 });
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(v);
}

/**
 * One series of monthly values. Bars grow from a zero baseline; negative
 * months (losses) hang below it in the danger color, with the sign also in
 * the tooltip and table so color is never the only cue.
 */
export function MonthlyBars({
  data,
  format = "money",
  currency = "PHP",
  height = 180,
  ariaLabel,
}: {
  data: BarDatum[];
  format?: Format;
  currency?: string;
  height?: number;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const zeroFromTop = (max / span) * 100;
  const peak = values.indexOf(max);

  return (
    <div>
      <div className="relative" style={{ height }} role="img" aria-label={ariaLabel}>
        {/* recessive gridlines: top value and zero */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <div className="pointer-events-none absolute left-0 top-0 -translate-y-full pb-0.5 text-[10px] tabular-nums text-muted">
          {fmt(max, format, currency)}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-muted/40"
          style={{ top: `${zeroFromTop}%` }}
        />
        {min < 0 && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-border" />
            <div className="pointer-events-none absolute bottom-0 left-0 z-[1] rounded-sm bg-surface/85 px-0.5 text-[10px] tabular-nums text-muted">
              {fmt(min, format, currency)}
            </div>
          </>
        )}
        <div className="absolute inset-0 flex gap-[2px]">
          {data.map((d, i) => {
            const v = d.value ?? 0;
            const h = (Math.abs(v) / span) * 100;
            const negative = v < 0;
            return (
              <div
                key={d.fullLabel}
                className="relative flex-1"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.fullLabel}: ${fmt(d.value, format, currency)}`}
              >
                {hover === i && <div className="absolute inset-0 rounded bg-surface-raised/60" />}
                {d.value != null && v !== 0 && (
                  <div
                    className={`absolute inset-x-[18%] ${negative ? "rounded-b" : "rounded-t"}`}
                    style={{
                      top: negative ? `${zeroFromTop}%` : `${zeroFromTop - h}%`,
                      height: `${Math.max(h, 0.8)}%`,
                      background: negative ? "var(--danger)" : "var(--accent)",
                      opacity: (hover == null || hover === i ? 1 : 0.55) * (d.partial ? 0.5 : 1),
                    }}
                  />
                )}
                {i === peak && max > 0 && hover == null && data.length <= 13 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 text-center text-[10px] font-medium tabular-nums text-foreground"
                    style={{ top: `calc(${zeroFromTop - h}% - 14px)` }}
                  >
                    {fmt(max, format, currency)}
                  </div>
                )}
                {hover === i && (
                  <div
                    className={`pointer-events-none absolute top-0 z-10 w-max max-w-[220px] rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg ${
                      i > data.length / 2 ? "right-0" : "left-0"
                    }`}
                  >
                    <div className="text-muted">{d.fullLabel}</div>
                    <div className="font-semibold tabular-nums text-foreground">{fmt(d.value, format, currency)}</div>
                    {d.note && <div className="mt-0.5 text-muted">{d.note}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.map((d) => (
          <div key={d.fullLabel} className="flex-1 truncate text-center text-[10px] text-muted">
            {d.label}
            {d.partial && "*"}
          </div>
        ))}
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-foreground">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.fullLabel} className="border-t border-border">
                <td className="py-1">{d.fullLabel}</td>
                <td className="py-1 text-right tabular-nums text-foreground">{fmt(d.value, format, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
