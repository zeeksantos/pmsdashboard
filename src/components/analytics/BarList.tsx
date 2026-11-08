/**
 * Labelled horizontal bars for a handful of categories (channels, expense
 * categories). Every row carries its name and value as text, so the swatch
 * color is never the only way to tell rows apart.
 */
export function BarList({
  rows,
  format,
}: {
  rows: { label: string; value: number; color?: string; sub?: string }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              {r.color && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />}
              <span className="truncate">{r.label}</span>
              {r.sub && <span className="shrink-0 text-xs text-muted">{r.sub}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-foreground">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-raised">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${Math.max(1, (Math.abs(r.value) / max) * 100)}%`,
                background: r.value < 0 ? "var(--danger)" : r.color ?? "var(--accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Dark-surface categorical steps, validated for CVD separation (dataviz). */
export const CHANNEL_COLORS: Record<string, string> = {
  airbnb: "#3987e5",
  booking: "#d95926",
  agoda: "#199e70",
  other: "#c98500",
};
