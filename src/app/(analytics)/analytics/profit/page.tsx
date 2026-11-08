import Link from "next/link";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio, periodOptions, resolvePeriod } from "@/lib/analytics/data";
import { breakEven, labelMonth, partialMonth, partialNote } from "@/lib/analytics/metrics";
import { formatMoney } from "@/lib/format";
import { PageHeader, Card } from "@/components/analytics/PageHeader";
import { Kpi, KpiGrid } from "@/components/analytics/Kpi";
import { PeriodPicker } from "@/components/analytics/PeriodPicker";
import { MonthlyBars } from "@/components/analytics/MonthlyBars";

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ws = await requireWorkspace();
  const period = resolvePeriod((await searchParams).period);
  const { portfolio: p } = await loadPortfolio(ws.workspace.id, period);
  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);
  const t = p.totals;
  const partial = partialMonth(p);
  const note = partialNote(p);
  const margin = t.netEarnings > 0 ? t.profit / t.netEarnings : null;
  const profitable = p.months.filter((mo) => p.total[mo].profit > 0).length;

  const breakEvens = p.units
    .filter((u) => !u.unit.archived)
    .map((u) => ({ u, be: breakEven(u, p.months) }))
    .sort((a, b) => (a.be.cushion ?? Infinity) - (b.be.cushion ?? Infinity));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profit & break-even"
        description="Net channel earnings minus fixed monthly costs and one-off expenses."
        actions={<PeriodPicker value={period.key} options={periodOptions()} />}
      />

      <KpiGrid>
        <Kpi label="Net earnings" value={money(t.netEarnings)} />
        <Kpi label="Expenses" value={money(t.expenses)} />
        <Kpi label="Profit" value={money(t.profit)} tone={t.profit < 0 ? "bad" : undefined} />
        <Kpi
          label="Profit margin"
          value={margin == null ? "—" : `${Math.round(margin * 100)}%`}
          sub={`${profitable} of ${p.months.length} months profitable`}
        />
      </KpiGrid>

      <Card title="Profit by month" description={`Losses hang below the line.${note ? ` * ${note}` : ""}`}>
        <MonthlyBars
          ariaLabel="Portfolio profit by month"
          currency={ws.workspace.base_currency}
          data={p.months.map((mo) => ({
            label: labelMonth(mo, false),
            fullLabel: labelMonth(mo),
            partial: mo === partial,
            value: p.total[mo].profit,
            note: `Earnings ${money(p.total[mo].netEarnings)} · expenses ${money(p.total[mo].expenses)}`,
          }))}
        />
      </Card>

      <Card
        title="Break-even by unit"
        description="Nights a month each unit needs, at its own average rate, to cover its fixed monthly costs."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Unit</th>
                <th className="pb-2 text-right font-medium">Fixed / month</th>
                <th className="pb-2 text-right font-medium">Avg rate</th>
                <th className="pb-2 text-right font-medium">Nights needed</th>
                <th className="pb-2 text-right font-medium">Avg nights</th>
                <th className="pb-2 pl-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {breakEvens.map(({ u, be }) => {
                let status: React.ReactNode;
                if (be.fixedMonthly <= 0) {
                  status = (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <CircleHelp className="h-4 w-4" /> Add fixed costs
                    </span>
                  );
                } else if (be.cushion == null) {
                  status = (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <CircleHelp className="h-4 w-4" /> No stays yet
                    </span>
                  );
                } else if (be.cushion >= 0) {
                  status = (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <CircleCheck className="h-4 w-4" /> Covered (+{be.cushion.toFixed(1)} nights)
                    </span>
                  );
                } else {
                  status = (
                    <span className="inline-flex items-center gap-1.5 text-danger">
                      <CircleAlert className="h-4 w-4" /> Short {Math.abs(be.cushion).toFixed(1)} nights
                    </span>
                  );
                }
                return (
                  <tr key={u.unit.id} className="border-t border-border">
                    <td className="py-2">
                      <Link href={`/analytics/units/${u.unit.id}?period=${period.key}`} className="text-foreground hover:text-accent">
                        {u.unit.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{be.fixedMonthly > 0 ? money(be.fixedMonthly) : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{be.adr == null ? "—" : money(be.adr)}</td>
                    <td className="py-2 text-right tabular-nums">{be.nightsNeeded == null || be.fixedMonthly <= 0 ? "—" : Math.ceil(be.nightsNeeded)}</td>
                    <td className="py-2 text-right tabular-nums">{be.avgNights.toFixed(1)}</td>
                    <td className="py-2 pl-4">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Monthly profit and loss">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 text-right font-medium">Stay earnings</th>
                <th className="pb-2 text-right font-medium">Adjustments & fees</th>
                <th className="pb-2 text-right font-medium">Expenses</th>
                <th className="pb-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {p.months.map((mo) => {
                const s = p.total[mo];
                return (
                  <tr key={mo} className="border-t border-border">
                    <td className="py-2">{labelMonth(mo)}</td>
                    <td className="py-2 text-right tabular-nums">{money(s.stayRevenue)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{money(s.otherRevenue)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{money(s.expenses)}</td>
                    <td className={`py-2 text-right tabular-nums ${s.profit < 0 ? "text-danger" : "text-foreground"}`}>{money(s.profit)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{money(t.stayRevenue)}</td>
                <td className="py-2 text-right tabular-nums">{money(t.otherRevenue)}</td>
                <td className="py-2 text-right tabular-nums">{money(t.expenses)}</td>
                <td className={`py-2 text-right tabular-nums ${t.profit < 0 ? "text-danger" : ""}`}>{money(t.profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
