"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money, shortDate } from "./ui";
import { RefreshButton } from "./RefreshButton";
import type { DashProps, TabProps } from "./types";
import { AdvancedTab, BuildingsTab, OccupancyTab, OverviewTab, UnitDrawer } from "./tabs-overview";
import { BreakEvenTab, IncomeTab, useCostState } from "./tabs-money";
import { CohostTab, ListingsTab, RefundsTab, TransactionsTab } from "./tabs-lists";
import { UpcomingTab } from "./tabs-upcoming";
import { SourcesTab } from "./tabs-sources";

export const TABS = [
  ["overview", "Overview"],
  ["buildings", "Buildings & units"],
  ["occupancy", "Occupancy"],
  ["upcoming", "Upcoming"],
  ["advanced", "Advanced"],
  ["income", "Monthly income"],
  ["costs", "Break-even (forecast)"],
  ["listings", "Listings"],
  ["sources", "Sources"],
  ["cohost", "Co-host"],
  ["adjust", "Refunds & claims"],
  ["tx", "All transactions"],
] as const;
export type TabKey = (typeof TABS)[number][0];

function setUrl(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(window.history.state, "", url);
}

export function Dashboard(props: DashProps & { initialTab: string; initialUnit: string | null }) {
  const { report: r, currency, brand } = props;
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(() =>
    TABS.some(([k]) => k === props.initialTab)
      ? (props.initialTab as TabKey)
      : !r.hasData && props.upcoming.count
        ? "upcoming"
        : "overview"
  );
  const [unit, setUnit] = useState<string | null>(props.initialUnit);
  const cs = useCostState(props.costs);
  const m = useCallback((n: number) => money(n, currency), [currency]);

  const openUnit = useCallback((id: string) => {
    setUnit(id);
    setUrl({ unit: id });
  }, []);
  const closeUnit = useCallback(() => {
    setUnit(null);
    setUrl({ unit: null });
  }, []);
  const pick = (k: TabKey) => {
    setTab(k);
    setUrl({ tab: k === "overview" ? null : k });
  };

  const tp: TabProps = useMemo(() => ({ ...props, m, openUnit }), [props, m, openUnit]);
  const urgent = r.alerts.filter((a) => a.severity === "high").length;

  return (
    <>
      <header className="top">
        <div className="top-row">
          <div>
            <h1>{brand}</h1>
            <p className="muted">
              {r.hasData ? (
                <>
                  {shortDate(r.window.start)}, {r.window.start.slice(0, 4)} – {shortDate(r.window.end)}, {r.window.end.slice(0, 4)} · {r.window.days} days ·
                  all amounts in {currency}
                </>
              ) : (
                <>No paid transactions in this period yet · all amounts in {currency}</>
              )}
            </p>
          </div>
          <div className="meta">
            <div className="controls">
              <RefreshButton loadedAt={props.loadedAt} />
              <select
              aria-label="Period"
              value={props.periodKey}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("period", e.target.value);
                url.searchParams.delete("unit");
                router.push(url.pathname + url.search);
              }}
            >
              {props.periodOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
              </select>
            </div>
            <div>
              {r.transactions.length.toLocaleString()} transactions · {r.units.filter((u) => !u.archived).length} units
            </div>
            <div>{props.generated}</div>
          </div>
        </div>
        <nav className="tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => pick(k)}>
              {label}
              {k === "overview" && urgent > 0 && <span className="badge">{urgent}</span>}
              {k === "upcoming" && props.upcoming.count > 0 && <span className="badge info">{props.upcoming.count}</span>}
            </button>
          ))}
        </nav>
      </header>
      <main className="dash" role="tabpanel" aria-label={TABS.find(([k]) => k === tab)?.[1]}>
        {!r.hasData && tab !== "upcoming" ? (
          <NoPaidData upcoming={props.upcoming.count} canEdit={props.canEdit} onUpcoming={() => pick("upcoming")} />
        ) : (
          <>
            {tab === "overview" && <OverviewTab {...tp} />}
            {tab === "buildings" && <BuildingsTab {...tp} />}
            {tab === "occupancy" && <OccupancyTab {...tp} />}
            {tab === "upcoming" && <UpcomingTab {...tp} />}
            {tab === "advanced" && <AdvancedTab {...tp} />}
            {tab === "income" && <IncomeTab {...tp} cs={cs} />}
            {tab === "costs" && <BreakEvenTab {...tp} cs={cs} />}
            {tab === "listings" && <ListingsTab {...tp} />}
            {tab === "sources" && <SourcesTab {...tp} />}
            {tab === "cohost" && <CohostTab {...tp} />}
            {tab === "adjust" && <RefundsTab {...tp} />}
            {tab === "tx" && <TransactionsTab {...tp} />}
          </>
        )}
      </main>
      <UnitDrawer {...tp} id={unit} onClose={closeUnit} />
    </>
  );
}

function NoPaidData({ upcoming, canEdit, onUpcoming }: { upcoming: number; canEdit: boolean; onUpcoming: () => void }) {
  return (
    <div className="panel">
      <div className="head">
        <h2>No paid transactions in this period yet</h2>
      </div>
      <p className="muted">
        This tab is built from money that has actually paid out. Upload Airbnb&apos;s <b>Transaction history</b> export (Menu → Earnings → Transaction
        history → Export CSV), or a Booking.com / Agoda reservations export, and it fills in.
        {upcoming > 0 && ` Your ${upcoming} upcoming booking${upcoming === 1 ? " is" : "s are"} on the Upcoming tab in the meantime.`}
      </p>
      <div className="filters" style={{ marginTop: 14 }}>
        {upcoming > 0 && (
          <button type="button" className="btn dark" onClick={onUpcoming}>
            See upcoming bookings
          </button>
        )}
        {canEdit && (
          <a className="btn" href="/analytics/import">
            Upload an export
          </a>
        )}
      </div>
    </div>
  );
}
