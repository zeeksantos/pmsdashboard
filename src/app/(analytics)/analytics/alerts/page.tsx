import { requireWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio, resolvePeriod } from "@/lib/analytics/data";
import { computeAlerts } from "@/lib/analytics/metrics";
import { formatMoney } from "@/lib/format";
import { getManilaToday, toManilaDateString } from "@/lib/calendar";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { AlertList } from "@/components/analytics/AlertList";

const RULES = [
  ["Occupancy drop", "Last full month is 15+ points below the unit's average for the 3 months before (30+ = urgent)."],
  ["Likely underpriced", "85%+ booked but the nightly rate is 10%+ below other units in the same area."],
  ["Price may be too high", "Under 40% booked with a nightly rate 10%+ above other units in the same area."],
  ["Losing money", "Profit after expenses was negative two months in a row."],
  ["No recent stays", "No booked nights in the 30 days before your latest data."],
  ["Below break-even", "Averages fewer nights a month than needed to cover the unit's fixed costs."],
  ["Unlinked listings / old data", "Listings not linked to a unit, or no upload in over 35 days."],
];

export default async function AlertsPage() {
  const ws = await requireWorkspace();
  // Alerts always look at the last 12 months so recent changes are caught.
  const period = resolvePeriod("12m");
  const { portfolio, listings, lastImportAt } = await loadPortfolio(ws.workspace.id, period);
  const alerts = computeAlerts(portfolio, {
    today: getManilaToday(),
    lastImportAt: lastImportAt ? toManilaDateString(lastImportAt) : null,
    unmappedListings: listings.filter((l) => !l.unit_id).length,
    formatMoney: (n) => formatMoney(n, ws.workspace.base_currency),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts"
        description="Automatic checks on occupancy, pricing and profit, based on your latest uploaded data."
      />
      {alerts.length === 0 ? (
        <EmptyState>Nothing needs attention right now.</EmptyState>
      ) : (
        <Card>
          <AlertList alerts={alerts} />
        </Card>
      )}
      <Card title="How alerts work">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {RULES.map(([name, rule]) => (
            <div key={name}>
              <dt className="font-medium text-foreground">{name}</dt>
              <dd className="text-muted">{rule}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
