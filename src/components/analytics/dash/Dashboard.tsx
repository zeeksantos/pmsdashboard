"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money, shortDate } from "./ui";
import type { DashProps, TabProps } from "./types";
import { AdvancedTab, BuildingsTab, OccupancyTab, OverviewTab, UnitDrawer } from "./tabs-overview";
import { BreakEvenTab, IncomeTab, useCostState } from "./tabs-money";
import { CohostTab, ListingsTab, RefundsTab, TransactionsTab } from "./tabs-lists";

export const TABS = [
  ["overview", "Overview"],
  ["buildings", "Buildings & units"],
  ["occupancy", "Occupancy"],
  ["advanced", "Advanced"],
  ["income", "Monthly income"],
  ["costs", "Break-even (forecast)"],
  ["listings", "Listings"],
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
  const [tab, setTab] = useState<TabKey>(() => (TABS.some(([k]) => k === props.initialTab) ? (props.initialTab as TabKey) : "overview"));
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
              {shortDate(r.window.start)}, {r.window.start.slice(0, 4)} – {shortDate(r.window.end)}, {r.window.end.slice(0, 4)} · {r.window.days} days · all
              amounts in {currency}
            </p>
          </div>
          <div className="meta">
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
            </button>
          ))}
        </nav>
      </header>
      <main className="dash" role="tabpanel" aria-label={TABS.find(([k]) => k === tab)?.[1]}>
        {tab === "overview" && <OverviewTab {...tp} />}
        {tab === "buildings" && <BuildingsTab {...tp} />}
        {tab === "occupancy" && <OccupancyTab {...tp} />}
        {tab === "advanced" && <AdvancedTab {...tp} />}
        {tab === "income" && <IncomeTab {...tp} cs={cs} />}
        {tab === "costs" && <BreakEvenTab {...tp} cs={cs} />}
        {tab === "listings" && <ListingsTab {...tp} />}
        {tab === "cohost" && <CohostTab {...tp} />}
        {tab === "adjust" && <RefundsTab {...tp} />}
        {tab === "tx" && <TransactionsTab {...tp} />}
      </main>
      <UnitDrawer {...tp} id={unit} onClose={closeUnit} />
    </>
  );
}
