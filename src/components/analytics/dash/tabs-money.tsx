"use client";

import { useMemo, useState, useTransition } from "react";
import type { ChartConfiguration } from "chart.js";
import { FIXED_CATEGORIES, type FixedCostInput } from "@/lib/analytics/metrics";
import { AREA_COLORS, NEG, POS, type UnitReport } from "@/lib/analytics/report";
import {
  copyMonthlyCosts,
  fillCleaningFromFees,
  saveMonthlyCosts,
  saveUnitCosts,
  type MonthlyCostField,
  type UnitCostField,
} from "@/app/(analytics)/analytics/cost-actions";
import { ChartBox, GRID, kTicks, Ledger, Panel, SOFT, tone, UnitCell } from "./ui";
import type { DashCosts, TabProps } from "./types";

type FixedField = (typeof FIXED_CATEGORIES)[number][0];
const blankFixed = (unit_id: string): FixedCostInput => ({ unit_id, rent: 0, other_fixed: 0, electricity: 0, water: 0, cleaning_per_stay: 0 });

// ═══════════════════════════ shared cost state ══════════════════════════
export interface CostState {
  fixedOf: (unitId: string) => FixedCostInput;
  monthlyOf: (unitId: string, month: string) => { cleaning: number; other: number };
  receiptsOf: (unitId: string | null, month: string) => number;
  setFixed: (unitId: string, field: UnitCostField, v: number) => void;
  setFixedMany: (values: { unitId: string; field: UnitCostField; v: number }[]) => void;
  setMonthly: (unitId: string, month: string, field: MonthlyCostField, v: number) => void;
  copyMonth: (from: string, to: string) => void;
  fillCleaning: (values: { unitId: string; perStay: number }[]) => void;
  status: string;
  anyFixed: boolean;
  fixedUnits: number;
}

const toFixed = (rows: FixedCostInput[]) => new Map(rows.map((r) => [r.unit_id, { ...r }]));
const toMonthly = (rows: DashCosts["monthly"]) =>
  new Map(rows.map((r) => [`${r.unit_id}|${r.month.slice(0, 7)}`, { cleaning: Number(r.cleaning), other: Number(r.other) }]));

/** Expense entries, kept locally so typing feels instant, saved to the workspace in the background. */
export function useCostState(costs: DashCosts): CostState {
  const [src, setSrc] = useState(costs);
  const [fixed, setFixedMap] = useState(() => toFixed(costs.fixed));
  const [monthly, setMonthlyMap] = useState(() => toMonthly(costs.monthly));
  const [status, setStatus] = useState("");
  const [, start] = useTransition();
  if (src !== costs) {
    // fresh data from the server after a save → take it as the truth
    setSrc(costs);
    setFixedMap(toFixed(costs.fixed));
    setMonthlyMap(toMonthly(costs.monthly));
  }
  const receipts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of costs.receipts) {
      const k = `${r.unit_id ?? ""}|${r.month}`;
      map.set(k, (map.get(k) ?? 0) + r.amount);
    }
    return map;
  }, [costs.receipts]);

  const run = (fn: () => Promise<unknown>) => {
    setStatus("Saving…");
    start(async () => {
      try {
        await fn();
        setStatus("Saved");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Couldn't save. Try again.");
      }
    });
  };

  return {
    fixedOf: (id) => fixed.get(id) ?? blankFixed(id),
    monthlyOf: (id, month) => monthly.get(`${id}|${month}`) ?? { cleaning: 0, other: 0 },
    receiptsOf: (id, month) => receipts.get(`${id ?? ""}|${month}`) ?? 0,
    setFixed: (id, field, v) => {
      setFixedMap((m) => new Map(m).set(id, { ...(m.get(id) ?? blankFixed(id)), [field]: v }));
      run(() => saveUnitCosts(id, { [field]: v }));
    },
    setFixedMany: (values) => {
      setFixedMap((m) => {
        const n = new Map(m);
        for (const x of values) n.set(x.unitId, { ...(n.get(x.unitId) ?? blankFixed(x.unitId)), [x.field]: x.v });
        return n;
      });
    },
    setMonthly: (id, month, field, v) => {
      setMonthlyMap((m) => {
        const k = `${id}|${month}`;
        return new Map(m).set(k, { ...(m.get(k) ?? { cleaning: 0, other: 0 }), [field]: v });
      });
      run(() => saveMonthlyCosts(id, month, { [field]: v }));
    },
    copyMonth: (from, to) => {
      setMonthlyMap((m) => {
        const n = new Map(m);
        for (const [k, v] of m) {
          const [id, mo] = k.split("|");
          if (mo === from && (v.cleaning > 0 || v.other > 0)) n.set(`${id}|${to}`, { ...v });
        }
        return n;
      });
      run(() => copyMonthlyCosts(from, to));
    },
    fillCleaning: (values) => {
      setFixedMap((m) => {
        const n = new Map(m);
        for (const x of values) n.set(x.unitId, { ...(n.get(x.unitId) ?? blankFixed(x.unitId)), cleaning_per_stay: Math.round(x.perStay) });
        return n;
      });
      run(() => fillCleaningFromFees(values));
    },
    status,
    anyFixed: [...fixed.values()].some((c) => FIXED_CATEGORIES.some(([f]) => c[f] > 0) || c.cleaning_per_stay > 0),
    fixedUnits: [...fixed.values()].filter((c) => FIXED_CATEGORIES.some(([f]) => c[f] > 0)).length,
  };
}

function CostInput({
  value,
  onCommit,
  fixed,
  canEdit,
  label,
  m,
}: {
  value: number;
  onCommit: (v: number) => void;
  fixed?: boolean;
  canEdit: boolean;
  label: string;
  m: (n: number) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!canEdit) return <>{value ? m(value) : "—"}</>;
  return (
    <span className="pin">
      <input
        className={`cin ${fixed ? "standing" : ""}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        aria-label={label}
        placeholder="0"
        value={draft ?? (value ? String(value) : "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft == null) return;
          const v = Math.max(0, Number(draft) || 0);
          setDraft(null);
          if (v !== value) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </span>
  );
}

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const operating = (u: UnitReport, i: number) => u.startMonthIndex >= 0 && i >= u.startMonthIndex;

function unitOrder(p: TabProps): UnitReport[] {
  const areaIdx = new Map(p.report.areas.map((a, i) => [a.name, i]));
  return p.report.units
    .filter((u) => !u.archived)
    .sort((a, b) => (areaIdx.get(a.area) ?? 99) - (areaIdx.get(b.area) ?? 99) || b.net - a.net);
}

// ═══════════════════════════ Monthly income (actuals) ═══════════════════
const MONTH_FIELDS: [MonthlyCostField, string][] = [
  ["cleaning", "Cleaning"],
  ["other", "Other"],
];

export function IncomeTab(p: TabProps & { cs: CostState }) {
  const { report: r, m, cs, canEdit, currency } = p;
  const units = useMemo(() => unitOrder(p), [p]);
  const lastData = r.window.monthDays.reduce((acc, d, i) => (d > 0 ? i : acc), r.months.length - 1);
  const [cur, setCur] = useState(lastData);

  // fixed bills run from each unit's first stay to the latest month with data or bills
  const hasVar = (id: string, i: number) => {
    const a = cs.monthlyOf(id, r.months[i]);
    return a.cleaning > 0 || a.other > 0 || cs.receiptsOf(id, r.months[i]) > 0;
  };
  let lastM = lastData;
  r.months.forEach((_, i) => {
    if (units.some((u) => hasVar(u.id, i))) lastM = Math.max(lastM, i);
  });

  const billsFor = (u: UnitReport, i: number) => {
    const on = operating(u, i) && i <= lastM;
    const f = cs.fixedOf(u.id);
    const mo = cs.monthlyOf(u.id, r.months[i]);
    const vals: Record<string, number> = {};
    for (const [k] of FIXED_CATEGORIES) vals[k] = on ? Number(f[k]) : 0;
    vals.cleaning = mo.cleaning;
    vals.other = mo.other;
    vals.receipts = cs.receiptsOf(u.id, r.months[i]);
    return vals;
  };
  const EXP_KEYS = [...FIXED_CATEGORIES.map(([k]) => k), "cleaning", "other", "receipts"] as const;
  const EXP_LABELS: Record<string, string> = {
    ...Object.fromEntries(FIXED_CATEGORIES.map(([k, l]) => [k, l])),
    cleaning: "Cleaning",
    other: "Other",
    receipts: "Receipts",
  };
  const total = (v: Record<string, number>) => EXP_KEYS.reduce((a, k) => a + (v[k] || 0), 0);
  const entered = (v: Record<string, number>) => EXP_KEYS.some((k) => v[k] > 0);
  const variableEntered = (v: Record<string, number>) => v.cleaning > 0 || v.other > 0 || v.receipts > 0;

  // whole-portfolio receipts not tied to a unit
  const looseReceipts = r.months.map((mo) => cs.receiptsOf(null, mo));

  // this month
  const rows = units.map((u) => {
    const v = billsFor(u, cur);
    const rev = u.monthNet[cur];
    const ex = total(v);
    return { u, v, rev, ex, net: rev - ex };
  });
  const cats = Object.fromEntries(EXP_KEYS.map((k) => [k, sumOf(rows.map((x) => x.v[k] || 0))]));
  cats.receipts += looseReceipts[cur];
  const tRev = sumOf(rows.map((x) => x.rev));
  const tExp = sumOf(rows.map((x) => x.ex)) + looseReceipts[cur];
  const nWithBills = rows.filter((x) => entered(x.v)).length;

  // every month
  const grid = units.map((u) => {
    let ytd = 0;
    const cells = r.months.map((_, i) => {
      const v = billsFor(u, i);
      const rev = u.monthNet[i];
      const ex = total(v);
      const has = entered(v) || rev !== 0;
      if (has) ytd += rev - ex;
      return { rev, ex, net: rev - ex, has, entered: entered(v), varOnly: variableEntered(v) };
    });
    return { u, cells, ytd };
  });
  const gRev = r.months.map((_, i) => sumOf(grid.map((g) => g.cells[i].rev)));
  const gExp = r.months.map((_, i) => sumOf(grid.map((g) => g.cells[i].ex)) + looseReceipts[i]);
  const gHas = r.months.map((_, i) => grid.some((g) => g.cells[i].entered) || looseReceipts[i] > 0);
  const gNet = gRev.map((v, i) => v - gExp[i]);
  const ytdRev = sumOf(gRev);
  const ytdExp = sumOf(gExp);
  const billedIdx = gHas.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  const netBilled = sumOf(billedIdx.map((i) => gNet[i]));
  const revBilled = sumOf(billedIdx.map((i) => gRev[i]));
  const lossMonths = billedIdx.filter((i) => gNet[i] < 0);
  const best = billedIdx.length ? billedIdx.reduce((a, i) => (gNet[i] > gNet[a] ? i : a), billedIdx[0]) : -1;

  const monthChart: ChartConfiguration = (() => {
    const keys = EXP_KEYS.filter((k) => cats[k] > 0);
    const net = tRev - tExp;
    return {
      type: "bar",
      data: {
        labels: ["Revenue", ...keys.map((k) => EXP_LABELS[k]), "Net income"],
        datasets: [
          {
            data: [tRev, ...keys.map((k) => -cats[k]), net],
            backgroundColor: [SOFT, ...keys.map(() => NEG), net < 0 ? NEG : POS],
            borderRadius: 3,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => m(c.raw as number) } } },
        scales: { y: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } },
      },
    };
  })();
  const allChart: ChartConfiguration = {
      type: "bar",
      data: {
        labels: r.monthLabels,
        datasets: [
          { type: "bar", label: "Revenue", data: gRev, backgroundColor: SOFT, borderRadius: 3, stack: "a" },
          { type: "bar", label: "Expenses", data: gExp.map((v) => -v), backgroundColor: NEG, borderRadius: 3, stack: "a" },
          {
            type: "line",
            label: "Net income",
            data: gNet.map((v, i) => (gHas[i] ? v : null)),
            borderColor: "#16232B",
            backgroundColor: "#16232B",
            tension: 0.25,
            pointRadius: 4,
            spanGaps: true,
            pointBackgroundColor: gNet.map((v) => (v < 0 ? NEG : POS)),
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}` } } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: kTicks(currency) }, grid: { color: GRID } } },
      },
  };

  const exportCsv = () => {
    const lines: (string | number)[][] = [["Unit", "Building", "Month", "Revenue", ...EXP_KEYS.map((k) => EXP_LABELS[k]), "Expenses", "Net income"]];
    for (const g of grid) {
      g.cells.forEach((c, i) => {
        if (!c.has) return;
        const v = billsFor(g.u, i);
        lines.push([g.u.name, g.u.building, r.months[i], c.rev.toFixed(2), ...EXP_KEYS.map((k) => v[k] || 0), c.ex.toFixed(2), c.net.toFixed(2)]);
      });
    }
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `monthly_income_${r.months[0]}_${r.months[r.months.length - 1]}.csv`;
    a.click();
  };

  const label = r.monthLabels[cur];
  return (
    <>
      <Ledger
        items={[
          { label: "Revenue in period", value: m(ytdRev), sub: "from your uploaded exports", kind: "money" },
          { label: "Expenses recorded", value: m(ytdExp), sub: `${billedIdx.length} month${billedIdx.length === 1 ? "" : "s"} with bills entered`, kind: "cost" },
          {
            label: "Net income (months with bills)",
            value: <span className={tone(netBilled)}>{m(netBilled)}</span>,
            sub: revBilled ? `${Math.round((100 * netBilled) / revBilled)}% margin` : "enter bills to see this",
            kind: "money",
          },
          { label: "Loss months", value: String(lossMonths.length), sub: lossMonths.map((i) => r.monthLabels[i]).join(", ") || "—", kind: "cost" },
          { label: "Best month", value: best >= 0 ? r.monthLabels[best] : "—", sub: best >= 0 ? m(gNet[best]) : "", kind: "guest" },
        ]}
      />
      <div className="grid wide-left">
        <Panel
          title={`Record actual expenses — ${label}`}
          sub="Rent, other fixed, electricity and water are standard monthly bills: enter each once per unit (yellow cells) and it's charged every month from the unit's first stay. Cleaning and other are entered per month. Receipts come from the Receipts page. Revenue comes from your uploaded exports."
        >
          <div className="filters">
            <button type="button" className="btn" onClick={() => setCur(Math.max(0, cur - 1))} aria-label="Previous month">
              ‹
            </button>
            <select value={cur} onChange={(e) => setCur(Number(e.target.value))} aria-label="Month">
              {r.months.map((mo, i) => (
                <option key={mo} value={i}>
                  {r.monthLabels[i]} {mo.slice(0, 4)}
                  {r.window.monthDays[i] === 0 ? " (no data yet)" : ""}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => setCur(Math.min(r.months.length - 1, cur + 1))} aria-label="Next month">
              ›
            </button>
            {canEdit && cur > 0 && (
              <button type="button" className="btn" onClick={() => cs.copyMonth(r.months[cur - 1], r.months[cur])}>
                Copy last month&apos;s cleaning/other
              </button>
            )}
            <span className="count">
              {nWithBills} of {rows.length} units have bills for {label} · {cs.fixedUnits} units have standard bills set
              {cs.status && ` · ${cs.status}`}
            </span>
          </div>
          <div className="table-scroll">
            <table className="t">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th className="num g-money">Revenue</th>
                  {FIXED_CATEGORIES.map(([k, l]) => (
                    <th key={k} className="num g-fixed">
                      {l}
                      <div className="muted small" style={{ fontWeight: 500 }}>
                        every month
                      </div>
                    </th>
                  ))}
                  {MONTH_FIELDS.map(([k, l]) => (
                    <th key={k} className="num g-var">
                      {l}
                      <div className="muted small" style={{ fontWeight: 500 }}>
                        this month only
                      </div>
                    </th>
                  ))}
                  <th className="num g-var">Receipts</th>
                  <th className="num g-risk">Expenses</th>
                  <th className="num g-money">Net income</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ u, v, rev, ex, net }) => (
                  <tr key={u.id} data-area style={{ "--area": u.color } as React.CSSProperties}>
                    <td>
                      <UnitCell name={u.name} nickname={u.nickname} building={u.building} />
                    </td>
                    <td className="num money">{m(rev)}</td>
                    {FIXED_CATEGORIES.map(([k, l]) => (
                      <td key={k} className="num">
                        <CostInput
                          fixed
                          canEdit={canEdit}
                          m={m}
                          label={`${u.name} ${l} per month`}
                          value={Number(cs.fixedOf(u.id)[k])}
                          onCommit={(val) => cs.setFixed(u.id, k, val)}
                        />
                      </td>
                    ))}
                    {MONTH_FIELDS.map(([k, l]) => (
                      <td key={k} className="num">
                        <CostInput
                          canEdit={canEdit}
                          m={m}
                          label={`${u.name} ${l} ${label}`}
                          value={v[k]}
                          onCommit={(val) => cs.setMonthly(u.id, r.months[cur], k, val)}
                        />
                      </td>
                    ))}
                    <td className="num muted">{v.receipts ? m(v.receipts) : "—"}</td>
                    <td className="num cost">{m(-ex)}</td>
                    <td className={`num ${tone(net)}`}>
                      <b>{m(net)}</b>
                    </td>
                  </tr>
                ))}
                {looseReceipts[cur] > 0 && (
                  <tr>
                    <td className="muted">Receipts not tied to a unit</td>
                    <td />
                    {FIXED_CATEGORIES.map(([k]) => (
                      <td key={k} />
                    ))}
                    <td />
                    <td />
                    <td className="num muted">{m(looseReceipts[cur])}</td>
                    <td className="num cost">{m(-looseReceipts[cur])}</td>
                    <td className="num neg">{m(-looseReceipts[cur])}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{m(tRev)}</td>
                  {EXP_KEYS.map((k) => (
                    <td key={k} className="num">
                      {m(cats[k])}
                    </td>
                  ))}
                  <td className="num">{m(tExp)}</td>
                  <td className={`num ${tone(tRev - tExp)}`}>{m(tRev - tExp)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
        <Panel title="This month">
          <ChartBox config={monthChart} height={260} label={`Revenue, expenses and net income for ${label}`} />
          <div className="head" style={{ marginTop: 20 }}>
            <h2>Saved for your team</h2>
          </div>
          <p className="note" style={{ marginTop: 0 }}>
            {canEdit
              ? "Everything you type is saved to your workspace straight away, so it's there on any device and for everyone you've invited."
              : "You have view-only access, so expenses can't be changed here."}
          </p>
          <div className="filters" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={exportCsv}>
              Export income CSV
            </button>
            <a className="btn" href="/analytics/expenses">
              Add a receipt
            </a>
          </div>
        </Panel>
      </div>
      <Panel
        title="Net income, every month"
        sub="Money earned that month minus the expenses recorded. “No bills” means nothing has been entered for that month yet."
        style={{ marginTop: 20 }}
      >
        <ChartBox config={allChart} label="Revenue, expenses and net income by month" />
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Unit</th>
                {r.monthLabels.map((mo, i) => (
                  <th key={mo + i} className={`num ${r.window.monthDays[i] ? "g-money" : ""}`}>
                    {mo}
                  </th>
                ))}
                <th className="num g-money">Period total</th>
              </tr>
            </thead>
            <tbody>
              {grid.map(({ u, cells, ytd }) => (
                <tr key={u.id} data-area style={{ "--area": u.color } as React.CSSProperties}>
                  <td>
                    <UnitCell name={u.name} nickname={u.nickname} building={u.building} />
                  </td>
                  {cells.map((c, i) =>
                    c.has ? (
                      <td
                        key={i}
                        className={`num ${c.entered ? tone(c.net) : "muted"}`}
                        title={`${r.monthLabels[i]}: revenue ${m(c.rev)}, expenses ${m(c.ex)}`}
                        style={c.entered && c.net < 0 ? { background: "var(--neg-soft)" } : undefined}
                      >
                        {m(c.net)}
                        {c.entered ? (
                          c.varOnly ? null : (
                            <div className="muted" style={{ fontSize: ".66rem" }}>
                              standard bills only
                            </div>
                          )
                        ) : (
                          <div className="muted" style={{ fontSize: ".66rem" }}>
                            no bills
                          </div>
                        )}
                      </td>
                    ) : (
                      <td key={i} className="num muted">
                        —
                      </td>
                    )
                  )}
                  <td className={`num ${tone(ytd)}`}>
                    <b>{m(ytd)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Net income</td>
                {gNet.map((v, i) => (
                  <td key={i} className={`num ${tone(v)}`}>
                    {gRev[i] || gHas[i] ? m(v) : "—"}
                  </td>
                ))}
                <td className={`num ${tone(ytdRev - ytdExp)}`}>{m(ytdRev - ytdExp)}</td>
              </tr>
              <tr>
                <td className="muted">Revenue</td>
                {gRev.map((v, i) => (
                  <td key={i} className="num muted">
                    {v ? m(v) : "—"}
                  </td>
                ))}
                <td className="num muted">{m(ytdRev)}</td>
              </tr>
              <tr>
                <td className="muted">Expenses</td>
                {gExp.map((v, i) => (
                  <td key={i} className="num muted">
                    {gHas[i] ? m(-v) : "—"}
                  </td>
                ))}
                <td className="num muted">{m(-ytdExp)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
}

// ═══════════════════════════ Break-even (forecast) ══════════════════════
const BE_FIELDS: [UnitCostField, string][] = [
  ["rent", "Rent / mo"],
  ["other_fixed", "Other fixed / mo"],
  ["electricity", "Electricity / mo"],
  ["water", "Water / mo"],
  ["cleaning_per_stay", "Cleaning / stay"],
];
const CAT_COLORS = [AREA_COLORS[0], "#7F8FB5", "#B8860B", AREA_COLORS[1], "#7FB3B4"];

export function BreakEvenTab(p: TabProps & { cs: CostState }) {
  const { report: r, m, cs, canEdit, currency } = p;
  const [days, setDays] = useState(30);
  const units = useMemo(() => unitOrder(p).filter((u) => u.first && u.activeDays > 0), [p]);

  const calc = (u: UnitReport) => {
    const c = cs.fixedOf(u.id);
    const mA = Math.max(u.activeDays, 1) / 30.4;
    const rev = u.net / mA;
    const nightsM = u.nights / mA;
    const staysM = u.stays / mA;
    const fixed = Number(c.rent) + Number(c.other_fixed);
    const variable = Number(c.electricity) + Number(c.water) + Number(c.cleaning_per_stay) * staysM;
    const profit = rev - fixed - variable;
    const varPerNight = nightsM ? variable / nightsM : 0;
    const contrib = u.adr - varPerNight;
    const beN = fixed > 0 ? (contrib > 0 ? fixed / contrib : Infinity) : 0;
    const beOcc = beN / days;
    const entered = BE_FIELDS.some(([f]) => Number(c[f]) > 0);
    return { c, rev, nightsM, staysM, fixed, variable, profit, margin: rev ? profit / rev : 0, beN, beOcc, entered, ok: u.rateActive >= beOcc };
  };
  const rows = units.map((u) => ({ u, x: calc(u) }));
  const T = (k: "rev" | "fixed" | "variable" | "profit") => sumOf(rows.map((r) => r.x[k]));
  const cat = (f: UnitCostField) => sumOf(rows.map(({ x }) => (f === "cleaning_per_stay" ? Number(x.c.cleaning_per_stay) * x.staysM : Number(x.c[f]))));
  const tRev = T("rev");
  const tFixed = T("fixed");
  const tVar = T("variable");
  const tProfit = T("profit");
  const nEntered = rows.filter((x) => x.x.entered).length;
  const below = rows.filter((x) => x.x.entered && x.x.fixed > 0 && !x.x.ok);

  const sorted = [...rows].sort((a, b) => b.x.profit - a.x.profit);
  const profitChart: ChartConfiguration = {
      type: "bar",
      data: {
        labels: sorted.map((x) => x.u.name),
        datasets: [
          { label: "Revenue", data: sorted.map((x) => x.x.rev), backgroundColor: SOFT, borderRadius: 3 },
          { label: "Profit", data: sorted.map((x) => x.x.profit), backgroundColor: sorted.map((x) => (x.x.profit < 0 ? NEG : x.u.color)), borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}` } } },
        scales: { x: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } }, y: { grid: { display: false } } },
      },
  };
  const expChart: ChartConfiguration = {
      type: "bar",
      data: {
        labels: ["Rent", "Other fixed", "Electricity", "Water", "Cleaning"],
        datasets: [{ data: BE_FIELDS.map(([f]) => cat(f)), backgroundColor: CAT_COLORS, borderRadius: 3 }],
      },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${m(c.raw as number)} / month` } } },
        scales: { y: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } }, x: { grid: { display: false } } },
      },
  };

  // forecast P&L month by month with the standard bills
  const lastIdx = r.months.length - 1;
  const pnl = units.map((u) => {
    const c = cs.fixedOf(u.id);
    const rv = u.monthNet;
    const exp = r.months.map((mo, i) => {
      if (!operating(u, i) || !r.window.monthDays[i]) return 0;
      const frac = Math.min(1, r.window.monthDays[i] / 30);
      return (Number(c.rent) + Number(c.other_fixed) + Number(c.electricity) + Number(c.water)) * frac + Number(c.cleaning_per_stay) * u.monthStays[i];
    });
    const prof = rv.map((v, i) => v - exp[i]);
    const neg = prof.filter((v, i) => operating(u, i) && !(r.window.partialLast && i === lastIdx) && r.window.monthDays[i] > 0 && v < 0).length;
    return { u, rv, exp, prof, neg, ytd: sumOf(prof) };
  });
  const tot = r.months.map((_, i) => sumOf(pnl.map((x) => x.prof[i])));
  const totRev = r.months.map((_, i) => sumOf(pnl.map((x) => x.rv[i])));
  const totExp = r.months.map((_, i) => sumOf(pnl.map((x) => x.exp[i])));
  const pnlChart: ChartConfiguration = {
      type: "bar",
      data: {
        labels: r.monthLabels,
        datasets: [
          { type: "bar", label: "Revenue", data: totRev, backgroundColor: SOFT, borderRadius: 3, stack: "a" },
          { type: "bar", label: "Expenses", data: totExp.map((v) => -v), backgroundColor: NEG, borderRadius: 3, stack: "a" },
          {
            type: "line",
            label: "Profit",
            data: tot,
            borderColor: "#16232B",
            backgroundColor: "#16232B",
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: tot.map((v) => (v < 0 ? NEG : POS)),
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}` } } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: kTicks(currency) }, grid: { color: GRID } } },
      },
  };

  const fillable = units.filter((u) => u.cleanPerStay > 0).map((u) => ({ unitId: u.id, perStay: u.cleanPerStay }));
  const pctTxt = (v: number) => `${Math.round(100 * v)}%`;

  return (
    <>
      <Ledger
        items={[
          { label: "Revenue / month", value: m(tRev), sub: "portfolio, per active month", kind: "money" },
          { label: "Fixed expenses", value: m(tFixed), sub: "rent + other fixed", kind: "cost" },
          { label: "Variable expenses", value: m(tVar), sub: "electricity + water + cleaning", kind: "cost" },
          {
            label: "Profit / month",
            value: <span className={tone(tProfit)}>{m(tProfit)}</span>,
            sub: tRev ? `${pctTxt(tProfit / tRev)} margin` : "",
            kind: "money",
          },
          { label: "Units with expenses entered", value: `${nEntered} of ${rows.length}`, kind: "guest" },
          { label: "Below break-even", value: String(below.length), sub: below.map((x) => x.u.name).join(", ") || "—", kind: "cost" },
        ]}
      />
      <Panel
        title="Expenses, profit and break-even per unit"
        sub="Type each unit's standard monthly expenses into the yellow cells — they're the same numbers the Monthly income tab uses. Fixed = rent + other fixed. Variable = electricity + water + cleaning."
        style={{ marginTop: 20 }}
      >
        <div className="filters">
          <label>
            Nights per month{" "}
            <input type="number" value={days} min={28} max={31} style={{ width: 70 }} onChange={(e) => setDays(Number(e.target.value) || 30)} />
          </label>
          {canEdit && fillable.length > 0 && (
            <button type="button" className="btn" onClick={() => cs.fillCleaning(fillable)}>
              Fill cleaning from channel cleaning fees
            </button>
          )}
          {cs.status && <span className="count">{cs.status}</span>}
        </div>
        <div className="table-scroll">
          <table className="t">
            <thead>
              <tr>
                <th>Unit</th>
                <th className="num g-money">Revenue / mo</th>
                <th className="num g-money">Per night</th>
                {BE_FIELDS.map(([f, l]) => (
                  <th key={f} className={`num ${f === "rent" || f === "other_fixed" ? "g-fixed" : "g-var"}`}>
                    {l}
                  </th>
                ))}
                <th className="num">Fixed</th>
                <th className="num">Variable</th>
                <th className="num g-money">Profit / mo</th>
                <th className="num">Margin</th>
                <th className="num g-occ" title="Nights a month the unit must be booked to cover its fixed costs.">
                  Break-even nights
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ u, x }) => (
                <tr key={u.id} data-area style={{ "--area": u.color } as React.CSSProperties}>
                  <td>
                    <UnitCell name={u.name} nickname={u.nickname} building={u.building} />
                  </td>
                  <td className="num">
                    {m(x.rev)}
                    <div className="muted" style={{ fontSize: ".72rem" }}>
                      {x.nightsM.toFixed(0)} nights · {x.staysM.toFixed(1)} stays
                    </div>
                  </td>
                  <td className="num">{m(u.adr)}</td>
                  {BE_FIELDS.map(([f, l]) => (
                    <td key={f} className="num">
                      <CostInput
                        fixed={f !== "cleaning_per_stay"}
                        canEdit={canEdit}
                        m={m}
                        label={`${u.name} ${l}`}
                        value={Number(x.c[f])}
                        onCommit={(v) => cs.setFixed(u.id, f, v)}
                      />
                    </td>
                  ))}
                  <td className="num">{m(x.fixed)}</td>
                  <td className="num">{m(x.variable)}</td>
                  <td className={`num ${tone(x.profit)}`}>
                    <b>{m(x.profit)}</b>
                  </td>
                  <td className={`num ${tone(x.profit)}`}>{x.entered ? pctTxt(x.margin) : "—"}</td>
                  <td className="num">
                    {x.fixed ? (
                      isFinite(x.beN) ? (
                        <>
                          {x.beN.toFixed(1)} <span className="muted">({pctTxt(x.beOcc)})</span>
                        </>
                      ) : (
                        "never"
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {x.fixed > 0 &&
                      (x.ok ? <span className="tag good">Above break-even</span> : <span className="tag bad">Below break-even</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Portfolio / month</td>
                <td className="num">{m(tRev)}</td>
                <td />
                {BE_FIELDS.map(([f]) => (
                  <td key={f} className="num">
                    {m(cat(f))}
                  </td>
                ))}
                <td className="num">{m(tFixed)}</td>
                <td className="num">{m(tVar)}</td>
                <td className={`num ${tone(tProfit)}`}>{m(tProfit)}</td>
                <td className="num">{tRev ? pctTxt(tProfit / tRev) : ""}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="note">
          Monthly revenue = money earned in the period ÷ months since the unit&apos;s first stay. Electricity and water are entered as monthly totals
          and treated as variable. Break-even nights = fixed ÷ (nightly rate − variable per night). Status compares that with how full the unit has been
          since its first stay.
        </p>
      </Panel>
      <div className="grid two">
        <Panel title="Profit by unit" sub="Monthly, after all expenses entered">
          <ChartBox config={profitChart} height={Math.max(280, 22 * sorted.length + 60)} label="Monthly revenue and profit by unit" />
        </Panel>
        <Panel title="Where the expenses go" sub="Portfolio monthly expenses by category">
          <ChartBox config={expChart} label="Monthly expenses by category" />
        </Panel>
      </div>
      <Panel
        title="Forecast profit month by month"
        sub={`Uses the standard monthly expenses above as an estimate — for actual bills, use the Monthly income tab. Expenses start from the month of each unit's first stay.${
          r.window.partialLast ? ` ${r.monthLabels[lastIdx]} is pro-rated to ${r.window.monthDays[lastIdx]} days.` : ""
        }`}
        style={{ marginTop: 20 }}
      >
        <ChartBox config={pnlChart} label="Forecast revenue, expenses and profit by month" />
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table className="t">
            {!cs.anyFixed && (
              <caption style={{ textAlign: "left", padding: "6px 0", color: "var(--amber)", fontWeight: 600 }}>
                No expenses entered yet — this currently shows revenue only.
              </caption>
            )}
            <thead>
              <tr>
                <th>Unit</th>
                {r.monthLabels.map((mo, i) => (
                  <th key={mo + i} className="num">
                    {mo}
                  </th>
                ))}
                <th className="num">Total</th>
                <th className="num">Loss months</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map(({ u, rv, exp, prof, neg, ytd }) => (
                <tr key={u.id} data-area style={{ "--area": u.color } as React.CSSProperties}>
                  <td>
                    <UnitCell name={u.name} nickname={u.nickname} building={u.building} />
                  </td>
                  {prof.map((v, i) =>
                    !operating(u, i) ? (
                      <td key={i} className="num muted">
                        —
                      </td>
                    ) : (
                      <td
                        key={i}
                        className={`num ${tone(v)}`}
                        title={`${r.monthLabels[i]}: revenue ${m(rv[i])}, expenses ${m(exp[i])}`}
                        style={v < 0 ? { background: "var(--neg-soft)" } : undefined}
                      >
                        {m(v)}
                      </td>
                    )
                  )}
                  <td className={`num ${tone(ytd)}`}>
                    <b>{m(ytd)}</b>
                  </td>
                  <td className={`num ${neg ? "neg" : ""}`}>{neg || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Portfolio profit</td>
                {tot.map((v, i) => (
                  <td key={i} className={`num ${tone(v)}`}>
                    {m(v)}
                  </td>
                ))}
                <td className={`num ${tone(sumOf(tot))}`}>{m(sumOf(tot))}</td>
                <td />
              </tr>
              <tr>
                <td className="muted">Revenue</td>
                {totRev.map((v, i) => (
                  <td key={i} className="num muted">
                    {m(v)}
                  </td>
                ))}
                <td className="num muted">{m(sumOf(totRev))}</td>
                <td />
              </tr>
              <tr>
                <td className="muted">Expenses</td>
                {totExp.map((v, i) => (
                  <td key={i} className="num muted">
                    {m(-v)}
                  </td>
                ))}
                <td className="num muted">{m(-sumOf(totExp))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
}

export type { FixedField };
