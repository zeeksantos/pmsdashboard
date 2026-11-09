import Link from "next/link";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio, periodOptions, resolvePeriod } from "@/lib/analytics/data";
import { adr, occupancy } from "@/lib/analytics/metrics";
import { CHANNEL_LABELS } from "@/lib/analytics/importers";
import { formatMoney, formatPercent } from "@/lib/format";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { PeriodPicker } from "@/components/analytics/PeriodPicker";
import { CHANNEL_COLORS } from "@/components/analytics/BarList";
import { UnitDialog } from "./UnitDialog";
import { ListingSelect } from "./ListingSelect";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ws = await requireWorkspace();
  const period = resolvePeriod((await searchParams).period);
  const { portfolio: p, units, listings, owners } = await loadPortfolio(ws.workspace.id, period);
  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);
  const showOwners = ws.workspace.kind === "manager";
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const listingCount = new Map<string, number>();
  for (const l of listings) if (l.unit_id) listingCount.set(l.unit_id, (listingCount.get(l.unit_id) ?? 0) + 1);
  const unlinked = listings.filter((l) => !l.unit_id);
  const unitOptions = units.filter((u) => !u.archived).map((u) => ({ id: u.id, name: u.building ? `${u.name} · ${u.building}` : u.name }));
  const rows = [...p.units].sort(
    (a, b) => Number(a.unit.archived) - Number(b.unit.archived) || b.totals.netEarnings - a.totals.netEarnings
  );

  const listingRow = (l: (typeof listings)[number]) => (
    <tr key={l.id} className="border-t border-border">
      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
          <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: CHANNEL_COLORS[l.channel] }} />
          {CHANNEL_LABELS[l.channel]}
        </span>
      </td>
      <td className="py-2 pr-3 text-foreground">{l.external_name}</td>
      <td className="w-64 py-2">
        <ListingSelect listingId={l.id} unitId={l.unit_id} units={unitOptions} disabled={!ws.canEdit} />
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unit setup"
        description="A unit is a physical place you rent out. Link each channel listing to its unit — a unit can have several (short-stay + long-term, Airbnb + Booking.com)."
        actions={
          <>
            <PeriodPicker value={period.key} options={periodOptions()} />
            {ws.canEdit && <UnitDialog owners={owners} showOwners={showOwners} />}
          </>
        }
      />

      {unlinked.length > 0 && (
        <Card
          title={`${unlinked.length} listing${unlinked.length === 1 ? "" : "s"} to link`}
          description={`${money(p.unassignedTotals.netEarnings)} of earnings in this period isn't counted toward any unit yet.`}
          className="border-warning/40"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>{unlinked.map(listingRow)}</tbody>
            </table>
          </div>
        </Card>
      )}

      {units.length === 0 ? (
        <EmptyState>
          No units yet. {listings.length > 0 ? "Pick “New unit with this name” above, or add units yourself." : (
            <>
              <Link href="/analytics/import" className="text-accent hover:underline">
                Upload an export
              </Link>{" "}
              first — listings are picked up automatically.
            </>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Unit</th>
                {showOwners && <th className="px-4 py-3 font-medium">Owner</th>}
                <th className="px-4 py-3 text-right font-medium">Nights</th>
                <th className="px-4 py-3 text-right font-medium">Occupancy</th>
                <th className="px-4 py-3 text-right font-medium">Avg rate</th>
                <th className="px-4 py-3 text-right font-medium">Net earnings</th>
                <th className="px-4 py-3 text-right font-medium">Expenses</th>
                <th className="px-4 py-3 text-right font-medium">Profit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ unit, totals }) => {
                const a = adr(totals);
                const full = units.find((u) => u.id === unit.id)!;
                                return (
                  <tr key={unit.id} className={`border-b border-border last:border-0 ${unit.archived ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/analytics?period=${period.key}&tab=buildings&unit=${unit.id}`} className="font-medium text-foreground hover:text-accent">
                        {unit.name}
                      </Link>
                      {full.nickname && <span className="ml-2 text-muted">{full.nickname}</span>}
                      <div className="text-xs text-muted">
                        {[unit.building, unit.area].filter(Boolean).join(" · ") || "—"}
                        {" · "}
                        {listingCount.get(unit.id) ?? 0} listing{listingCount.get(unit.id) === 1 ? "" : "s"}
                        {unit.archived && " · archived"}
                      </div>
                    </td>
                    {showOwners && (
                      <td className="px-4 py-3 text-muted">{unit.owner_id ? ownerName.get(unit.owner_id) : "—"}</td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">{totals.nights}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(occupancy(totals))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{a == null ? "—" : money(a)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(totals.netEarnings)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{money(totals.expenses)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${totals.profit < 0 ? "text-danger" : "text-foreground"}`}>
                      {money(totals.profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ws.canEdit && <UnitDialog unit={full} owners={owners} showOwners={showOwners} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {listings.length > unlinked.length && (
        <details className="rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            All linked listings ({listings.length - unlinked.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>{listings.filter((l) => l.unit_id).map(listingRow)}</tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
