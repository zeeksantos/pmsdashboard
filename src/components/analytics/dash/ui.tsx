"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import type { ChartConfiguration } from "chart.js";

// ── formatting ───────────────────────────────────────────────────────────
const SYMBOLS: Record<string, string> = { PHP: "₱", USD: "$", EUR: "€", GBP: "£", JPY: "¥" };

export function money(n: number, currency = "PHP"): string {
  const sym = SYMBOLS[currency] ?? currency + " ";
  const v = Math.round(n);
  return (v < 0 ? "−" : "") + sym + Math.abs(v).toLocaleString("en-PH");
}
export const pct = (r: number | null | undefined, d = 0) => (r == null || !isFinite(r) ? "—" : (100 * r).toFixed(d) + "%");
export const tone = (n: number) => (n < -0.5 ? "neg" : n > 0.5 ? "pos" : "");
export const kTicks = (currency = "PHP") => (v: number | string) => {
  const n = Number(v);
  const sym = SYMBOLS[currency] ?? "";
  return Math.abs(n) >= 1000 ? `${n < 0 ? "−" : ""}${sym}${Math.abs(n) / 1000}k` : `${sym}${n}`;
};
export function shortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export const GRID = "#EBEFF0";
export const SOFT = "#CDD5D8";

// ── ledger (KPI strip) ───────────────────────────────────────────────────
export type LedgerKind = "money" | "cost" | "occ" | "guest" | "bora";
export interface LedgerItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  kind: LedgerKind;
  title?: string;
}
export function Ledger({ items }: { items: LedgerItem[] }) {
  return (
    <div className="ledger">
      {items.map((it) => (
        <div key={it.label} className={`k-${it.kind}`} title={it.title}>
          <div className="lbl">{it.label}</div>
          <div className="val">{it.value}</div>
          {it.sub != null && it.sub !== "" && <div className="sub">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  sub,
  children,
  style,
  className = "",
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`panel ${className}`} style={style}>
      {(title || sub) && (
        <div className="head">
          {title && <h2>{title}</h2>}
          {sub && <p>{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ── charts ───────────────────────────────────────────────────────────────
export function ChartBox({
  config,
  height = 280,
  label,
}: {
  config: ChartConfiguration;
  height?: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  // Create once; afterwards update the same chart in place so re-renders
  // (typing an expense, sorting a table) don't rebuild or flicker it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const options = { maintainAspectRatio: false, responsive: true, ...(config.options ?? {}) };
    const c = chart.current;
    if (c && (c.config as ChartConfiguration).type === config.type) {
      c.data = config.data;
      c.options = options as typeof c.options;
      c.update();
      return;
    }
    c?.destroy();
    Chart.defaults.font.family = getComputedStyle(el).fontFamily;
    Chart.defaults.color = "#4F5F68";
    chart.current = new Chart(el, { ...config, options } as ChartConfiguration);
  }, [config]);
  useEffect(
    () => () => {
      chart.current?.destroy();
      chart.current = null;
    },
    []
  );
  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

// ── sortable table ───────────────────────────────────────────────────────
export interface Col<T> {
  key: string;
  label: React.ReactNode;
  num?: boolean;
  grp?: "money" | "occ" | "book" | "risk" | "fixed" | "var";
  tip?: string;
  def?: "asc" | "desc";
  value?: (row: T) => number | string | null;
  sortable?: boolean;
}

export function SortTable<T>({
  rows,
  cols,
  render,
  footer,
  caption,
}: {
  rows: T[];
  cols: Col<T>[];
  render: (row: T) => React.ReactNode;
  footer?: (rows: T[]) => React.ReactNode;
  caption?: React.ReactNode;
}) {
  const initial = cols.find((c) => c.def);
  const [key, setKey] = useState<string | null>(initial?.key ?? null);
  const [dir, setDir] = useState<"asc" | "desc">(initial?.def ?? "desc");
  const sorted = useMemo(() => {
    if (!key) return rows;
    const col = cols.find((c) => c.key === key);
    const get = col?.value ?? ((r: T) => (r as Record<string, unknown>)[key] as number | string | null);
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? r : -r;
    });
  }, [rows, cols, key, dir]);
  return (
    <table className="t">
      {caption}
      <thead>
        <tr>
          {cols.map((c) => {
            const canSort = c.sortable !== false;
            const cls = [
              c.num ? "num" : "",
              c.grp ? `g-${c.grp}` : "",
              c.tip ? "hastip" : "",
              canSort ? "sortable" : "",
              key === c.key ? dir : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <th
                key={c.key}
                className={cls}
                title={c.tip}
                aria-sort={key === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}
                onClick={
                  canSort
                    ? () => {
                        if (key === c.key) setDir(dir === "asc" ? "desc" : "asc");
                        else {
                          setKey(c.key);
                          setDir(c.num ? "desc" : "asc");
                        }
                      }
                    : undefined
                }
              >
                {c.label}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{sorted.map(render)}</tbody>
      {footer && <tfoot>{footer(sorted)}</tfoot>}
    </table>
  );
}

/** Background for a "how full" cell: the unit's area colour at strength r. */
export function shade(rgb: string, r: number, min = 0.05, span = 0.38) {
  return `rgba(${rgb},${(min + span * Math.max(0, Math.min(1, r))).toFixed(2)})`;
}

export function UnitCell({ name, nickname, building }: { name: string; nickname?: string; building?: string }) {
  return (
    <>
      <b>{name}</b>
      {(nickname || building) && <div className="muted small">{nickname || building}</div>}
    </>
  );
}
