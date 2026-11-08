import { labelMonth, occupancy, partialMonth, partialNote, type Portfolio } from "@/lib/analytics/metrics";
import { formatPercent } from "@/lib/format";
import { Card } from "./PageHeader";

/**
 * Unit × month occupancy, sequential blue (light = low, dark = high) with
 * the percentage printed in every cell, so it reads without color too.
 */
export function OccupancyHeatmap({ p }: { p: Portfolio }) {
  const units = p.units.filter((u) => !u.unit.archived && u.totals.availableNights > 0);
  if (units.length === 0) return null;
  const partial = partialMonth(p);
  const ramp = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  const cell = (occ: number | null) => {
    if (occ == null) return { background: "transparent", color: "var(--muted)" };
    const idx = Math.min(ramp.length - 1, Math.floor(occ * ramp.length));
    // Dark ink on the light steps, white from step 4 on (both ≥ 4.5:1).
    return { background: ramp[idx], color: idx >= 4 ? "#ffffff" : "#0b1120" };
  };
  return (
    <Card
      title="Occupancy by unit and month"
      description={`Darker = busier. Blank months are before the unit started or after your latest data.${partial ? ` * ${partialNote(p)}` : ""}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface pr-2 text-left font-medium text-muted">Unit</th>
              {p.months.map((mo) => (
                <th key={mo} className="px-1 text-center font-medium text-muted">
                  {labelMonth(mo, false)}
                  {mo === partial && "*"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.unit.id}>
                <td className="sticky left-0 max-w-[160px] truncate bg-surface pr-2 text-foreground">{u.unit.name}</td>
                {p.months.map((mo) => {
                  const s = u.months[mo];
                  const occ = occupancy(s);
                  return (
                    <td
                      key={mo}
                      className="h-8 min-w-[42px] rounded text-center tabular-nums"
                      style={mo === partial ? { ...cell(occ), opacity: 0.55 } : cell(occ)}
                      title={`${u.unit.name}, ${labelMonth(mo)}: ${s.nights} of ${s.availableNights} nights`}
                    >
                      {formatPercent(occ)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
