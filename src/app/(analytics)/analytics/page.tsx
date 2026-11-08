import Link from "next/link";
import { Upload } from "lucide-react";
import { lookupWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio, periodOptions, resolvePeriod } from "@/lib/analytics/data";
import { adr, computeAlerts, labelMonth, occupancy, partialMonth, partialNote } from "@/lib/analytics/metrics";
import { CHANNEL_LABELS } from "@/lib/analytics/importers";
import { formatMoney, formatPercent } from "@/lib/format";
import { getManilaToday, toManilaDateString } from "@/lib/calendar";
import { PRODUCT_NAME } from "@/lib/analytics/branding";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { Kpi, KpiGrid } from "@/components/analytics/Kpi";
import { PeriodPicker } from "@/components/analytics/PeriodPicker";
import { MonthlyBars } from "@/components/analytics/MonthlyBars";
import { BarList, CHANNEL_COLORS } from "@/components/analytics/BarList";
import { AlertList } from "@/components/analytics/AlertList";
import { primaryButton } from "@/components/analytics/ui";
import { OnboardingForm } from "./OnboardingForm";

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ws = await lookupWorkspace();

  if (ws.status === "no_workspace") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-foreground">Welcome to {PRODUCT_NAME}</h1>
        <p className="mt-2 text-sm text-muted">
          Upload your Airbnb, Booking.com or Agoda earnings exports and see occupancy, nightly rates, expenses and
          profit for every unit. Your first 14 days are free.
        </p>
        <OnboardingForm />
        <p className="mt-6 text-xs text-muted">
          Invited by someone? Ask them to invite <strong className="text-foreground">{ws.email}</strong> from their
          Settings page, then refresh.
        </p>
      </div>
    );
  }
  if (ws.status !== "ok") return null;

  const sp = await searchParams;
  const period = resolvePeriod(sp.period);
  const { portfolio: p, listings, lastImportAt } = await loadPortfolio(ws.workspace.id, period);
  const currency = ws.workspace.base_currency;
  const money = (n: number) => formatMoney(n, currency);

  const header = (
    <PageHeader
      title="Overview"
      description={`${period.label} · ${labelMonth(period.from)} – ${labelMonth(period.to)}`}
      actions={
        <>
          <PeriodPicker value={period.key} options={periodOptions()} />
          {ws.canEdit && (
            <Link href="/analytics/import" className={primaryButton}>
              <Upload className="h-4 w-4" /> Upload export
            </Link>
          )}
        </>
      }
    />
  );

  if (!lastImportAt) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState>
          No data yet.{" "}
          <Link href="/analytics/import" className="text-accent hover:underline">
            Upload your first earnings export
          </Link>{" "}
          — Airbnb&apos;s transaction history CSV, or a Booking.com / Agoda reservations export.
        </EmptyState>
      </div>
    );
  }

  const t = p.totals;
  const occ = occupancy(t);
  const partial = partialMonth(p);
  const note = partialNote(p);
  const nightly = adr(t);
  const alerts = computeAlerts(p, {
    today: getManilaToday(),
    lastImportAt: toManilaDateString(lastImportAt),
    unmappedListings: listings.filter((l) => !l.unit_id).length,
    formatMoney: money,
  });

  const unitsByProfit = [...p.units]
    .filter((u) => !u.unit.archived && (u.totals.netEarnings !== 0 || u.totals.expenses !== 0))
    .sort((a, b) => b.totals.profit - a.totals.profit);

  // Best five and worst three when the list is long.
  const truncated = unitsByProfit.length > 8;
  const shownUnits = truncated ? [...unitsByProfit.slice(0, 5), ...unitsByProfit.slice(-3)] : unitsByProfit;

  const channelRows = Object.entries(p.byChannel)
    .filter(([, v]) => Math.abs(v) >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([ch, v]) => ({
      label: CHANNEL_LABELS[ch as keyof typeof CHANNEL_LABELS] ?? ch,
      value: v,
      color: CHANNEL_COLORS[ch],
      sub: t.netEarnings ? `${Math.round((v / t.netEarnings) * 100)}%` : undefined,
    }));

  return (
    <div className="flex flex-col gap-6">
      {header}

      <KpiGrid>
        <Kpi label="Net earnings" value={money(t.netEarnings)} sub="After channel fees, co-host shares & refunds" />
        <Kpi
          label="Occupancy"
          value={formatPercent(occ)}
          sub={`${t.nights.toLocaleString()} of ${t.availableNights.toLocaleString()} nights booked`}
        />
        <Kpi label="Avg nightly rate" value={nightly == null ? "—" : money(nightly)} sub={`${t.stays} stays`} />
        <Kpi
          label="Profit after expenses"
          value={money(t.profit)}
          tone={t.profit < 0 ? "bad" : undefined}
          sub={t.expenses ? `${money(t.expenses)} in expenses` : "No expenses entered yet"}
        />
      </KpiGrid>

      {alerts.length > 0 && (
        <Card
          title="Needs attention"
          actions={
            <Link href="/analytics/alerts" className="text-xs text-accent hover:underline">
              All {alerts.length} alerts
            </Link>
          }
        >
          <AlertList alerts={alerts.slice(0, 3)} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Net earnings by month"
          description={`Stays are split across the months they cover.${note ? ` * ${note}` : ""}`}
        >
          <MonthlyBars
            ariaLabel="Net earnings by month"
            currency={currency}
            data={p.months.map((mo) => ({
              label: labelMonth(mo, false),
              fullLabel: labelMonth(mo),
              partial: mo === partial,
              value: p.total[mo].netEarnings,
              note: `${p.total[mo].nights} nights · profit ${money(p.total[mo].profit)}`,
            }))}
          />
        </Card>
        <Card
          title="Occupancy by month"
          description={`Booked nights ÷ nights your units were operating.${note ? ` * ${note}` : ""}`}
        >
          <MonthlyBars
            ariaLabel="Occupancy by month"
            format="percent"
            data={p.months.map((mo) => ({
              label: labelMonth(mo, false),
              fullLabel: labelMonth(mo),
              partial: mo === partial,
              value: occupancy(p.total[mo]),
              note: `${p.total[mo].nights} of ${p.total[mo].availableNights} nights`,
            }))}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Where earnings come from" className="lg:col-span-2">
          {channelRows.length ? <BarList rows={channelRows} format={money} /> : <p className="text-sm text-muted">No earnings in this period.</p>}
        </Card>
        <Card
          title="Units by profit"
          className="lg:col-span-3"
          actions={
            <Link href="/analytics/units" className="text-xs text-accent hover:underline">
              All units
            </Link>
          }
        >
          {unitsByProfit.length === 0 ? (
            <p className="text-sm text-muted">
              Link your listings to units on the{" "}
              <Link href="/analytics/units" className="text-accent hover:underline">
                Units page
              </Link>{" "}
              to see per-unit numbers.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 font-medium">Unit</th>
                    <th className="pb-2 text-right font-medium">Occupancy</th>
                    <th className="pb-2 text-right font-medium">Avg rate</th>
                    <th className="pb-2 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {shownUnits.map(
                    (u, i) => {
                      const gap = truncated && i === 5;
                      const a = adr(u.totals);
                      return (
                        <tr key={u.unit.id} className={`border-t border-border ${gap ? "border-t-2 border-dashed" : ""}`}>
                          <td className="py-2">
                            <Link href={`/analytics/units/${u.unit.id}`} className="text-foreground hover:text-accent">
                              {u.unit.name}
                            </Link>
                            {u.unit.building && <span className="ml-1 text-xs text-muted">{u.unit.building}</span>}
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatPercent(occupancy(u.totals))}</td>
                          <td className="py-2 text-right tabular-nums">{a == null ? "—" : money(a)}</td>
                          <td className={`py-2 text-right tabular-nums ${u.totals.profit < 0 ? "text-danger" : "text-foreground"}`}>
                            {money(u.totals.profit)}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
          {p.unassignedTotals.netEarnings !== 0 && (
            <p className="mt-3 text-xs text-muted">
              {money(p.unassignedTotals.netEarnings)} is from listings not yet linked to a unit.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
