import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio, periodOptions, resolvePeriod } from "@/lib/analytics/data";
import { adr, breakEven, labelMonth, occupancy, partialMonth, partialNote } from "@/lib/analytics/metrics";
import { CHANNEL_LABELS, KIND_LABELS } from "@/lib/analytics/importers";
import { formatMoney, formatPercent, formatManilaDate } from "@/lib/format";
import { PageHeader, Card } from "@/components/analytics/PageHeader";
import { Kpi, KpiGrid } from "@/components/analytics/Kpi";
import { PeriodPicker } from "@/components/analytics/PeriodPicker";
import { MonthlyBars } from "@/components/analytics/MonthlyBars";
import { ConfirmButton } from "@/components/analytics/ConfirmButton";
import { UnitDialog } from "../UnitDialog";
import { deleteRecurringCost, deleteUnit } from "../actions";
import { RecurringCostForm } from "./RecurringCostForm";

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const ws = await requireWorkspace();
  const period = resolvePeriod((await searchParams).period);
  const supabase = await createClient();
  const { portfolio: p, listings, owners, units } = await loadPortfolio(ws.workspace.id, period, supabase);
  const stats = p.units.find((u) => u.unit.id === id);
  const unit = units.find((u) => u.id === id);
  if (!stats || !unit) notFound();

  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);
  const myListings = listings.filter((l) => l.unit_id === id);
  const listingIds = myListings.map((l) => l.id);

  const [{ data: costs }, { data: recent }] = await Promise.all([
    supabase.from("an_recurring_costs").select("*").eq("unit_id", id).order("starts_on", { ascending: false }),
    listingIds.length
      ? supabase
          .from("an_transactions")
          .select("id, kind, channel, guest_name, check_in, check_out, nights, amount_base, txn_date, confirmation_code")
          .in("listing_id", listingIds)
          .neq("kind", "payout")
          .order("txn_date", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const t = stats.totals;
  const partial = partialMonth(p);
  const note = partialNote(p);
  const be = breakEven(stats, p.months);
  const owner = unit.owner_id ? owners.find((o) => o.id === unit.owner_id) : null;
  const operatingMonths = p.months.filter((mo) => stats.months[mo].availableNights > 0 || stats.months[mo].netEarnings !== 0 || stats.months[mo].expenses > 0);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/analytics/units?period=${period.key}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Units
      </Link>
      <PageHeader
        title={unit.name}
        description={
          [unit.building, unit.area, owner && `Owner: ${owner.name}`, unit.active_from && `Operating since ${formatManilaDate(unit.active_from)}`]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <>
            <PeriodPicker value={period.key} options={periodOptions()} />
            {ws.canEdit && (
              <>
                <UnitDialog unit={unit} owners={owners} showOwners={ws.workspace.kind === "manager"} />
                <ConfirmButton
                  action={deleteUnit.bind(null, unit.id)}
                  label="Delete unit"
                  confirmText={`Delete ${unit.name}? Its listings become unlinked and its fixed costs are removed. Imported transactions are kept.`}
                />
              </>
            )}
          </>
        }
      />

      <KpiGrid>
        <Kpi label="Net earnings" value={money(t.netEarnings)} sub={`${t.stays} stays · ${t.nights} nights`} />
        <Kpi label="Occupancy" value={formatPercent(occupancy(t))} sub={`${t.nights} of ${t.availableNights} nights`} />
        <Kpi label="Avg nightly rate" value={adr(t) == null ? "—" : money(adr(t)!)} sub="What you keep per booked night" />
        <Kpi label="Profit" value={money(t.profit)} tone={t.profit < 0 ? "bad" : undefined} sub={`${money(t.expenses)} expenses`} />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profit by month" className="lg:col-span-2" description={note ? `* ${note}` : undefined}>
          <MonthlyBars
            ariaLabel={`${unit.name} profit by month`}
            currency={ws.workspace.base_currency}
            data={p.months.map((mo) => ({
              label: labelMonth(mo, false),
              fullLabel: labelMonth(mo),
              partial: mo === partial,
              value: stats.months[mo].profit,
              note: `Earnings ${money(stats.months[mo].netEarnings)} · expenses ${money(stats.months[mo].expenses)}`,
            }))}
          />
        </Card>
        <Card title="Break-even">
          {be.fixedMonthly <= 0 ? (
            <p className="text-sm text-muted">Add this unit&apos;s fixed monthly costs below to see how many nights it needs to cover them.</p>
          ) : be.nightsNeeded == null ? (
            <p className="text-sm text-muted">No booked nights yet in this period to work out a nightly rate.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <div className="text-3xl font-semibold tabular-nums text-foreground">{Math.ceil(be.nightsNeeded)} nights</div>
                <div className="text-muted">a month to cover {money(be.fixedMonthly)} in fixed costs at {money(be.adr!)}/night</div>
              </div>
              <div className={be.cushion! >= 0 ? "text-success" : "text-danger"}>
                {be.cushion! >= 0 ? "✓ " : "✗ "}
                Averaging {be.avgNights.toFixed(1)} nights a month —{" "}
                {be.cushion! >= 0
                  ? `${be.cushion!.toFixed(1)} nights above break-even`
                  : `${Math.abs(be.cushion!).toFixed(1)} nights short`}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Month by month">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 text-right font-medium">Nights</th>
                <th className="pb-2 text-right font-medium">Occupancy</th>
                <th className="pb-2 text-right font-medium">Avg rate</th>
                <th className="pb-2 text-right font-medium">Earnings</th>
                <th className="pb-2 text-right font-medium">Expenses</th>
                <th className="pb-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {operatingMonths.map((mo) => {
                const s = stats.months[mo];
                const a = adr(s);
                return (
                  <tr key={mo} className="border-t border-border">
                    <td className="py-2">{labelMonth(mo)}</td>
                    <td className="py-2 text-right tabular-nums">{s.nights}</td>
                    <td className="py-2 text-right tabular-nums">{formatPercent(occupancy(s))}</td>
                    <td className="py-2 text-right tabular-nums">{a == null ? "—" : money(a)}</td>
                    <td className="py-2 text-right tabular-nums">{money(s.netEarnings)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{money(s.expenses)}</td>
                    <td className={`py-2 text-right tabular-nums ${s.profit < 0 ? "text-danger" : ""}`}>{money(s.profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Fixed monthly costs"
          description="Rent or amortization, utilities averages, dues — entered once, applied every month in range."
        >
          {!costs?.length ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="text-foreground">{c.category}</div>
                    <div className="text-xs text-muted">
                      {labelMonth(c.starts_on.slice(0, 7))} → {c.ends_on ? labelMonth(c.ends_on.slice(0, 7)) : "ongoing"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-foreground">{money(Number(c.monthly_amount))}/mo</span>
                    {ws.canEdit && (
                      <ConfirmButton
                        action={deleteRecurringCost.bind(null, c.id)}
                        label={`Remove ${c.category}`}
                        confirmText={`Remove the ${c.category} cost? Past months will no longer include it.`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {ws.canEdit && <RecurringCostForm unitId={unit.id} defaultStart={(unit.active_from ?? period.from).slice(0, 7)} />}
          <p className="mt-3 text-xs text-muted">
            One-off costs with receipts go on the{" "}
            <Link href="/analytics/expenses" className="text-accent hover:underline">
              Expenses page
            </Link>
            .
          </p>
        </Card>

        <Card title="Listings & recent activity">
          <ul className="mb-4 flex flex-wrap gap-2">
            {myListings.length === 0 && <li className="text-sm text-muted">No listings linked yet.</li>}
            {myListings.map((l) => (
              <li key={l.id} className="rounded-md border border-border px-2 py-1 text-xs text-foreground">
                <span className="text-muted">{CHANNEL_LABELS[l.channel]}:</span> {l.external_name}
              </li>
            ))}
          </ul>
          {recent && recent.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5 pr-2">
                        <div className="text-foreground">{r.guest_name ?? KIND_LABELS[r.kind]}</div>
                        <div className="text-xs text-muted">
                          {r.check_in ? `${r.check_in} → ${r.check_out}` : r.txn_date}
                          {r.kind !== "booking" && ` · ${KIND_LABELS[r.kind]}`}
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted">{r.nights ? `${r.nights}n` : ""}</td>
                      <td className={`py-1.5 text-right tabular-nums ${Number(r.amount_base) < 0 ? "text-danger" : "text-foreground"}`}>
                        {money(Number(r.amount_base))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
