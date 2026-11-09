"use client";

import { useMemo } from "react";
import type { ChartConfiguration } from "chart.js";
import { CHANNEL_LABELS } from "@/lib/analytics/importers";
import { INK, NEG } from "@/lib/analytics/report";
import { AlertList } from "@/components/analytics/AlertList";
import { ChartBox, GRID, kTicks, Ledger, Panel, SOFT, pct, shade, shortDate, SortTable, tone, UnitCell } from "./ui";
import type { TabProps } from "./types";

// ═══════════════════════════ Overview ═══════════════════════════════════
export function OverviewTab(p: TabProps) {
  const { report: r, m, currency } = p;
  const o = r.overview;
  const days = r.window.days;

  const monthly = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: {
        labels: r.monthLabels,
        datasets: [
          { label: "Net earnings", data: o.monthlyNet, backgroundColor: INK, borderRadius: 3, barPercentage: 0.6 },
          { label: "Gross", data: o.monthlyGross, backgroundColor: SOFT, borderRadius: 3, barPercentage: 0.6 },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}` } } },
        scales: { y: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } }, x: { grid: { display: false } } },
      },
    }),
    [r, o, m, currency]
  );
  const streams = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: {
        labels: r.monthLabels,
        datasets: o.streams.map((s) => ({ label: s.label, data: s.values, backgroundColor: s.color, stack: "a", borderRadius: 2 })),
      },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10 } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: kTicks(currency) }, grid: { color: GRID } },
        },
      },
    }),
    [r, o, m, currency]
  );
  const activity = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: {
        labels: r.monthLabels,
        datasets: [
          { type: "bar", label: "Nights", data: o.activity.nights, backgroundColor: SOFT, borderRadius: 3, yAxisID: "y" },
          { type: "line", label: "Bookings", data: o.activity.bookings, borderColor: INK, backgroundColor: INK, tension: 0.3, pointRadius: 3, yAxisID: "y1" },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { position: "left", grid: { color: GRID }, title: { display: true, text: "nights" } },
          y1: { position: "right", grid: { display: false }, title: { display: true, text: "bookings" } },
          x: { grid: { display: false } },
        },
      },
    }),
    [r, o]
  );

  const streamTotal = o.streams.reduce((a, s) => a + s.total, 0);
  const cur = (code: string, n: number) =>
    code === currency ? m(n) : `${code} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <Ledger
        items={[
          { label: "Net earnings", value: m(o.net), sub: "after fees, co-host shares and adjustments", kind: "money" },
          { label: "Gross earnings", value: m(o.gross), sub: o.cohostReceived ? `incl. ${m(o.cohostReceived)} co-host shares` : "", kind: "money" },
          {
            label: "Adjustments",
            value: m(o.adjustments),
            sub: o.cohostPaid ? `incl. ${m(o.cohostPaid)} co-host share paid` : "refunds, claims, changes",
            kind: "cost",
          },
          { label: "Channel service fees", value: m(o.fees), sub: o.gross ? `${pct(-o.fees / o.gross, 1)} of gross` : "", kind: "cost" },
          { label: "Nights booked", value: o.nights.toLocaleString(), sub: `${(o.nights / days).toFixed(1)} nights per day across the portfolio`, kind: "occ" },
          { label: "Average stay", value: `${o.avgStay.toFixed(1)} nights`, sub: `${o.stays.toLocaleString()} stays`, kind: "occ" },
          { label: "Net per day", value: m(o.netPerDay), sub: `run-rate ≈ ${m(o.netPerDay * 365)} per year`, kind: "money" },
        ]}
      />
      <div className="grid two">
        <Panel title="Net earnings by month" sub="By the month the money was earned">
          <ChartBox config={monthly} label="Net and gross earnings by month" />
        </Panel>
        <Panel title="Where the money comes from" sub="By area, co-host income and adjustments">
          <ChartBox config={streams} label="Earnings by source and month" />
          <p className="note">
            Total {m(streamTotal)}.{" "}
            {o.streams
              .filter((s) => s.total > 0)
              .map((s) => `${s.label.replace(" (you host)", "")} ${pct(s.total / (streamTotal || 1))}`)
              .join(", ")}
            .
          </p>
        </Panel>
      </div>
      <div className="grid two">
        <Panel title="Monthly booking activity" sub="Stays and nights, by the month they were paid">
          <ChartBox config={activity} label="Bookings and nights by month" />
        </Panel>
        <Panel title="Payout methods">
          {o.payouts.length === 0 ? (
            <p className="muted small">No payout lines in this period.</p>
          ) : (
            <table className="t">
              <tbody>
                {o.payouts.map((x) => (
                  <tr key={x.method + x.currency}>
                    <td>{x.method}</td>
                    <td className="num">{cur(x.currency, x.amount)}</td>
                    <td className="num muted">{pct(x.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="head" style={{ marginTop: 18 }}>
            <h2>Earnings by type</h2>
          </div>
          <table className="t">
            <tbody>
              {o.byType.map((t) => (
                <tr key={t.label}>
                  <td>{t.label}</td>
                  <td className={`num ${tone(t.amount)}`}>{m(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      {r.alerts.length > 0 && (
        <Panel title="Needs attention" style={{ marginTop: 20 }}>
          <AlertList alerts={r.alerts.slice(0, 4)} onUnit={p.openUnit} />
        </Panel>
      )}
    </>
  );
}

// ═══════════════════════════ Buildings & units ══════════════════════════
export function BuildingsTab(p: TabProps) {
  const { report: r, m } = p;
  const byId = new Map(r.units.map((u) => [u.id, u]));
  const maxNet = Math.max(1, ...r.units.map((u) => u.net));
  return (
    <>
      <Panel
        title="Every unit, by building"
        sub="Net earnings, all listings for that unit combined. Click a unit for detail."
      />
      <div className="board">
        {r.buildings.map((b) => (
          <div key={b.name} className="bldg" style={{ "--area": b.color } as React.CSSProperties}>
            <h3>
              {b.name}
              <span>{m(b.total)}</span>
            </h3>
            {b.unitIds.map((id) => {
              const u = byId.get(id)!;
              const label = u.nickname || u.listings[0]?.name || u.area;
              return (
                <button key={id} type="button" className={`unit ${u.net ? "" : "zero"}`} onClick={() => p.openUnit(id)}>
                  <div className="no">{u.name}</div>
                  <div className="name">
                    <b>{label}</b>
                    {u.listings.length} listing{u.listings.length === 1 ? "" : "s"} · {u.nights} nights ·{" "}
                    <b style={{ display: "inline" }}>{pct(u.rate)} booked</b>
                    {u.archived && " · archived"}
                  </div>
                  <div className="amt">
                    {m(u.net)}
                    <small>{u.adr ? `${m(u.adr)}/night` : ""}</small>
                  </div>
                  <div className="fill">
                    <i style={{ width: `${(100 * Math.max(0, u.net)) / maxNet}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {r.unlinkedListings > 0 && (
        <p className="note">
          {r.unlinkedListings} listing{r.unlinkedListings === 1 ? " is" : "s are"} not linked to a unit yet (
          {m(r.overview.unlinkedNet)}). Link them on <a href="/analytics/units">Unit setup</a>.
        </p>
      )}
    </>
  );
}

export function UnitDrawer({ id, onClose, ...p }: TabProps & { id: string | null; onClose: () => void }) {
  const { report: r, m } = p;
  const u = id ? r.units.find((x) => x.id === id) : null;
  const rows = useMemo(() => {
    if (!u) return [];
    const ids = new Set(u.listings.map((l) => l.id));
    return r.transactions.filter((t) => t.listingId && ids.has(t.listingId) && t.kind !== "payout");
  }, [r, u]);
  const stays = rows.filter((t) => t.kind === "booking" || (t.kind === "cohost" && t.amountBase > 0));
  const refunds = rows.filter((t) => !["booking", "cohost"].includes(t.kind)).reduce((a, t) => a + t.amountBase, 0);
  return (
    <>
      <div className={`scrim ${u ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${u ? "open" : ""}`} aria-hidden={!u} aria-label="Unit detail">
        {u && (
          <>
            <button type="button" className="btn" style={{ float: "right" }} onClick={onClose}>
              Close
            </button>
            <h2>
              {u.building ? `${u.building} · ` : ""}
              {u.name}
            </h2>
            {u.nickname && (
              <p>
                <b>{u.nickname}</b>
              </p>
            )}
            <p className="muted">
              {u.area}
              {u.first && ` · operating since ${shortDate(u.first)}`}
            </p>
            <dl className="kv">
              <dt>Net earnings</dt>
              <dd>{m(u.net)}</dd>
              <dt>Gross earnings</dt>
              <dd>{m(u.gross)}</dd>
              <dt>Stays / nights</dt>
              <dd>
                {u.stays} / {u.nights}
              </dd>
              <dt>Booked (since first stay)</dt>
              <dd>{pct(u.rateActive)}</dd>
              <dt>Average per booked night</dt>
              <dd>{m(u.adr)}</dd>
              <dt>Refunds &amp; claims</dt>
              <dd className={tone(refunds)}>{m(refunds)}</dd>
            </dl>
            <h3>Listings on this unit</h3>
            <table className="t">
              <tbody>
                {u.listings.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.name}
                      <div className="muted small">{CHANNEL_LABELS[l.channel as keyof typeof CHANNEL_LABELS] ?? l.channel}</div>
                    </td>
                    <td className="num">{m(l.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginTop: 16 }}>Recent stays</h3>
            <table className="t">
              <thead>
                <tr>
                  <th>Paid</th>
                  <th>Guest</th>
                  <th>Stay</th>
                  <th className="num">Nights</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stays.slice(0, 40).map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{shortDate(t.date)}</td>
                    <td>{t.guest}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {shortDate(t.checkIn)}–{shortDate(t.checkOut)}
                    </td>
                    <td className="num">{t.nights ?? ""}</td>
                    <td className={`num ${tone(t.amountBase)}`}>{m(t.amountBase)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              <a href="/analytics/units">Edit this unit or its listings</a>
            </p>
          </>
        )}
      </aside>
    </>
  );
}

// ═══════════════════════════ Occupancy ══════════════════════════════════
export function OccupancyTab(p: TabProps) {
  const { report: r, m } = p;
  const rows = r.units.filter((u) => !u.archived && u.first);
  const days = r.window.days;
  const best = [...rows].sort((a, b) => b.rate - a.rate)[0];
  const under = rows.filter((u) => u.rate < 0.3);
  const rateOf = (us: typeof rows) => (us.length ? us.reduce((a, u) => a + u.nights, 0) / (us.length * days) : 0);
  return (
    <>
      <Ledger
        items={[
          {
            label: "Portfolio booking rate",
            value: pct(r.occupancy.rate),
            sub: `${r.occupancy.nights.toLocaleString()} of ${r.occupancy.unitNights.toLocaleString()} unit-nights`,
            kind: "occ",
          },
          ...r.occupancy.byArea.map((a) => ({
            label: a.area,
            value: pct(a.rate),
            sub: `${a.units} unit${a.units === 1 ? "" : "s"}`,
            kind: "occ" as const,
          })),
          ...(best ? [{ label: "Best unit", value: `${best.name} · ${pct(best.rate)}`, sub: best.nickname || best.building, kind: "occ" as const }] : []),
          { label: "Units under 30%", value: String(under.length), sub: under.map((u) => u.name).join(", ") || "—", kind: "cost" },
        ]}
      />
      <div className="grid two">
        <Panel
          title="Booking rate per unit"
          sub={`Nights occupied ÷ ${days} nights, from the stay dates. “Since first stay” only counts days after the unit's first booking.`}
        >
          <div className="table-scroll">
            <SortTable
              rows={rows}
              cols={[
                { key: "name", label: "Unit" },
                { key: "rate", label: "Booking rate", num: true, def: "desc", grp: "occ", tip: `Nights booked ÷ all ${days} nights in the period, even if the unit wasn't listed yet for part of it.` },
                { key: "nights", label: "Nights", num: true, tip: "Nights booked in the period." },
                { key: "stays", label: "Stays", num: true, tip: "Number of separate bookings." },
                { key: "avgStay", label: "Avg stay", num: true, tip: "Average nights per booking." },
                { key: "rateActive", label: "Since first stay", num: true, grp: "occ", tip: "Nights booked ÷ nights since the unit's first booking. Fairer for units that went live mid-period." },
                { key: "perAvail", label: "Per available night", num: true, grp: "money", tip: "Earnings ÷ every night in the period, booked or not (RevPAR)." },
                { key: "first", label: "First stay" },
              ]}
              render={(u) => (
                <tr key={u.id} data-area style={{ "--area": u.color } as React.CSSProperties}>
                  <td>
                    <UnitCell name={u.name} nickname={u.nickname} building={u.building} />
                  </td>
                  <td className="num">
                    <span className="occbar" style={{ "--area": u.color } as React.CSSProperties}>
                      <i style={{ width: `${100 * u.rate}%` }} />
                    </span>
                    <b>{pct(u.rate)}</b>
                  </td>
                  <td className="num">{u.nights}</td>
                  <td className="num">{u.stays}</td>
                  <td className="num">{u.avgStay.toFixed(1)}</td>
                  <td className="num" style={{ background: shade(u.rgb, u.rateActive) }}>
                    {pct(u.rateActive)}
                    <div className="muted small">{u.activeDays} days</div>
                  </td>
                  <td className="num money">{m(u.perAvail)}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {shortDate(u.first)}
                  </td>
                </tr>
              )}
              footer={(us) => (
                <tr>
                  <td>{us.length} units</td>
                  <td className="num">{pct(rateOf(us))}</td>
                  <td className="num">{us.reduce((a, u) => a + u.nights, 0)}</td>
                  <td className="num">{us.reduce((a, u) => a + u.stays, 0)}</td>
                  <td />
                  <td className="num">{pct(us.reduce((a, u) => a + u.nights, 0) / Math.max(1, us.reduce((a, u) => a + u.activeDays, 0)))}</td>
                  <td />
                  <td />
                </tr>
              )}
            />
          </div>
        </Panel>
        <Panel title="Month by month" sub="Occupancy % per unit">
          <div style={{ overflowX: "auto" }}>
            <Heat
              months={r.monthLabels}
              rows={[...rows].sort((a, b) => b.rate - a.rate).map((u) => ({
                key: u.id,
                label: u.name,
                sub: u.nickname,
                rgb: u.rgb,
                cells: u.monthNights.map((n, i) => {
                  const d = r.window.monthDays[i];
                  const before = u.startMonthIndex < 0 || i < u.startMonthIndex;
                  if (!d || before) return null;
                  const ratio = n / d;
                  return { ratio, text: String(Math.round(100 * ratio)), title: `${u.name} ${r.monthLabels[i]}: ${n}/${d} nights` };
                }),
              }))}
            />
          </div>
          <p className="note">
            Only stays in your uploaded exports are counted, so future bookings and anything after{" "}
            {shortDate(r.window.end)} aren&apos;t included yet.
            {r.window.partialLast && ` ${r.monthLabels[r.monthLabels.length - 1]} only covers ${r.window.monthDays[r.window.monthDays.length - 1]} days.`}
          </p>
        </Panel>
      </div>
    </>
  );
}

export function Heat({
  months,
  rows,
  small,
}: {
  months: string[];
  rows: { key: string; label: string; sub?: string; rgb: string; cells: ({ ratio: number; text: string; title: string } | null)[] }[];
  small?: boolean;
}) {
  return (
    <div className="heat" style={{ gridTemplateColumns: `150px repeat(${months.length}, minmax(34px, 1fr))` }}>
      <div />
      {months.map((mo, i) => (
        <div key={mo + i} className="h">
          {mo}
        </div>
      ))}
      {rows.map((row) => [
        <div key={row.key} className="u" title={row.sub}>
          <b>{row.label}</b> {row.sub && <span className="muted">{row.sub}</span>}
        </div>,
        ...row.cells.map((c, i) =>
          c ? (
            <div
              key={row.key + i}
              className="c"
              title={c.title}
              style={{
                background: `rgba(${row.rgb},${(0.08 + 0.85 * Math.min(1, c.ratio)).toFixed(2)})`,
                color: c.ratio > 0.55 ? "#fff" : "#16232B",
                fontSize: small ? "0.72rem" : undefined,
              }}
            >
              {c.text}
            </div>
          ) : (
            <div key={row.key + i} className="c muted" style={{ background: "rgba(22,35,43,0.03)", fontWeight: 400 }}>
              —
            </div>
          )
        ),
      ])}
    </div>
  );
}

// ═══════════════════════════ Advanced ═══════════════════════════════════
const TIPS = {
  adr: "Average money earned per night the unit was actually booked, after the cleaning fee is taken out. For co-host units this is your share, not what the guest paid.",
  rateActive: "How full the unit has been since its first booking: nights booked ÷ nights available. 70% means it was booked 7 nights out of 10.",
  wdOcc: "How full the unit is on Sunday to Thursday nights. Low weekday numbers mean there's room to discount midweek.",
  weOcc: "How full the unit is on Friday and Saturday nights.",
  lead: "How many days before check-in guests usually book (the typical/median guest). A small number means most guests book last minute.",
  sameDay: "Share of stays that were booked on the day of check-in.",
  orphan: "Empty gaps of 1 or 2 nights between two bookings. Hard to sell and wasted unless you allow 1-night stays or discount them. Red = 8 or more.",
  ltrShare: "Share of booked nights from a long-stay listing (name contains LTR, long-term or monthly). Dash = no long-stay listing.",
  refundRate: "Money refunded or clawed back ÷ money earned. Above 5% (red) usually means complaints or cancellations worth looking into.",
  repeat: "Guests who stayed more than once ÷ total guests for this unit.",
  revShare: "This unit's share of all the money earned across the portfolio.",
};

function cumulativeShare(values: number[], total: number): number[] {
  const out: number[] = [];
  let run = 0;
  for (const v of values) {
    run += v;
    out.push(total ? (100 * run) / total : 0);
  }
  return out;
}

export function AdvancedTab(p: TabProps) {
  const { report: r, m, currency } = p;
  const A = r.advanced;
  const rows = r.units.filter((u) => !u.archived && u.first);
  const par = [...rows].sort((a, b) => b.net - a.net);
  const totRev = par.reduce((a, u) => a + u.net, 0);
  const cumArr = cumulativeShare(par.map((u) => u.net), totRev);
  const n80 = cumArr.findIndex((v) => v >= 80) + 1;
  const hasLead = A.leadMedian != null;

  const adrChart = useMemo<ChartConfiguration>(
    () => ({
      type: "line",
      data: {
        labels: r.monthLabels,
        datasets: A.adrByArea.map((a) => ({ label: a.area, data: a.values, borderColor: a.color, backgroundColor: a.color, tension: 0.3, spanGaps: true })),
      },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}/night` } } },
        scales: { y: { ticks: { callback: (v) => m(Number(v)) }, grid: { color: GRID } }, x: { grid: { display: false } } },
      },
    }),
    [r, A, m]
  );
  const leadChart = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: { labels: A.leadBuckets.map((b) => b.label), datasets: [{ data: A.leadBuckets.map((b) => b.count), backgroundColor: INK, borderRadius: 3 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: GRID }, title: { display: true, text: "stays" } }, x: { grid: { display: false } } } },
    }),
    [A]
  );
  const pareto = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: {
        labels: par.map((u) => u.name),
        datasets: [
          { type: "bar", label: "Earnings", data: par.map((u) => u.net), backgroundColor: par.map((u) => u.color), borderRadius: 3, yAxisID: "y" },
          { type: "line", label: "Cumulative %", data: cumArr, borderColor: INK, backgroundColor: INK, tension: 0.3, pointRadius: 2, yAxisID: "y1" },
        ],
      },
      options: {
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (c) => (c.dataset.type === "line" ? `${(c.raw as number).toFixed(0)}% cumulative` : m(c.raw as number)) } },
        },
        scales: {
          y: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } },
          y1: { position: "right", min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { display: false } },
          x: { grid: { display: false } },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, m, currency]
  );
  const season = useMemo<ChartConfiguration>(
    () => ({
      type: "line",
      data: {
        labels: r.monthLabels,
        datasets: A.seasonality.map((s) => ({ label: s.area, data: s.values, borderColor: s.color, backgroundColor: s.color, tension: 0.3, spanGaps: true })),
      },
      options: {
        plugins: { legend: { position: "bottom" } },
        scales: { y: { grid: { color: GRID }, ticks: { callback: (v) => `${Number(v).toFixed(1)}×` } }, x: { grid: { display: false } } },
      },
    }),
    [r, A]
  );

  return (
    <>
      <Ledger
        items={[
          {
            label: "Days booked ahead (typical)",
            value: hasLead ? `${A.leadMedian} days` : "—",
            sub: hasLead ? `${pct(A.sameDayShare)} book same day` : "needs booking dates in the export",
            kind: "guest",
            title: "How many days before check-in the typical guest books.",
          },
          { label: "Weekend occupancy", value: pct(A.weekendRate), sub: "Fri + Sat nights, since each unit went live", kind: "occ" },
          { label: "Weekday occupancy", value: pct(A.weekdayRate), sub: "Sun – Thu nights", kind: "occ" },
          {
            label: "Empty gap nights",
            value: A.orphanTotal.toLocaleString(),
            sub: `1–2 night gaps between stays, ≈ ${m(A.orphanValue)} at average rate`,
            kind: "cost",
          },
          { label: "Refund rate", value: pct(A.refundRate, 1), sub: `${m(A.refundTotal)} returned or clawed back`, kind: "cost" },
          { label: "Returning guests", value: `${A.repeatGuests} of ${A.totalGuests}`, sub: `${A.repeatStays} extra stays from returners`, kind: "guest" },
          { label: "Top 3 units", value: `${pct(A.top3Share)} of earnings`, sub: A.top3.join(", "), kind: "guest" },
          ...(A.payoutLag != null
            ? [{ label: "Payout timing", value: `+${A.payoutLag} day${A.payoutLag === 1 ? "" : "s"}`, sub: "after check-in", kind: "guest" as const }]
            : []),
        ]}
      />
      <div className="grid two">
        <Panel title="Nightly rate by month" sub="Realised rate (gross minus cleaning ÷ nights), by check-in month">
          <ChartBox config={adrChart} label="Average nightly rate by area and month" />
        </Panel>
        <Panel title="How far ahead guests book" sub="Number of stays by days between booking and check-in">
          {hasLead ? (
            <>
              <ChartBox config={leadChart} label="Stays by booking lead time" />
              <p className="note">
                Median lead time by booking month:{" "}
                {A.leadByMonth
                  .map((v, i) => (v == null ? null : `${r.monthLabels[i]} ${v}d`))
                  .filter(Boolean)
                  .join(", ") || "—"}
                .
              </p>
            </>
          ) : (
            <p className="muted small">Your exports don&apos;t include booking dates yet. Airbnb&apos;s transaction history includes them when you export all columns.</p>
          )}
        </Panel>
      </div>
      <Panel title="Unit scorecard" sub="Everything per unit in one row. Hover a column name or a number to see what it means. Click a header to sort." style={{ marginTop: 20 }}>
        <div className="legend">
          <span style={{ "--sw": "var(--pos)" } as React.CSSProperties}>Money</span>
          <span style={{ "--sw": "var(--city)" } as React.CSSProperties}>How full (darker = fuller)</span>
          <span style={{ "--sw": "var(--amber)" } as React.CSSProperties}>Booking behaviour</span>
          <span style={{ "--sw": "var(--neg)" } as React.CSSProperties}>Warning signs (darker = worse)</span>
          {r.areas.map((a) => (
            <span key={a.name} style={{ "--sw": a.color } as React.CSSProperties}>
              {a.name}
            </span>
          ))}
        </div>
        <div className="table-scroll">
          <SortTable
            rows={rows}
            cols={[
              { key: "name", label: "Unit" },
              { key: "adr", label: "Earned per night", num: true, tip: TIPS.adr, grp: "money" },
              { key: "rateActive", label: "How full", num: true, def: "desc", tip: TIPS.rateActive, grp: "occ" },
              { key: "wd", label: "Weekdays full", num: true, tip: TIPS.wdOcc, grp: "occ", value: (u) => (u.weekdayNights.avail ? u.weekdayNights.booked / u.weekdayNights.avail : 0) },
              { key: "we", label: "Weekends full", num: true, tip: TIPS.weOcc, grp: "occ", value: (u) => (u.weekend.avail ? u.weekend.booked / u.weekend.avail : 0) },
              { key: "lead", label: "Days booked ahead", num: true, tip: TIPS.lead, grp: "book" },
              { key: "sameDay", label: "Same-day bookings", num: true, tip: TIPS.sameDay, grp: "book" },
              { key: "orphan", label: "Empty gap nights", num: true, tip: TIPS.orphan, grp: "risk" },
              { key: "ltrShare", label: "Long-stay share", num: true, tip: TIPS.ltrShare, grp: "book" },
              { key: "refundRate", label: "Refund rate", num: true, tip: TIPS.refundRate, grp: "risk" },
              { key: "repeatGuests", label: "Returning guests", num: true, tip: TIPS.repeat, grp: "book" },
              { key: "revShare", label: "Share of earnings", num: true, tip: TIPS.revShare, grp: "money" },
            ]}
            render={(u) => {
              const wd = u.weekdayNights.avail ? u.weekdayNights.booked / u.weekdayNights.avail : 0;
              const we = u.weekend.avail ? u.weekend.booked / u.weekend.avail : 0;
              return (
                <tr key={u.id} data-area style={{ "--area": u.color } as React.CSSProperties}>
                  <td>
                    <UnitCell name={u.name} nickname={u.nickname} building={u.building} />
                  </td>
                  <td className="num money" title={`${u.name} earns about ${m(u.adr)} for every night it's booked (cleaning fee excluded).`}>
                    {m(u.adr)}
                  </td>
                  <td className="num" style={{ background: shade(u.rgb, u.rateActive) }} title={`Booked ${u.nights} of ${u.activeDays} nights since its first stay on ${shortDate(u.first)}.`}>
                    {pct(u.rateActive)}
                  </td>
                  <td className="num" style={{ background: shade(u.rgb, wd) }} title={`Sunday–Thursday nights: booked ${u.weekdayNights.booked} of ${u.weekdayNights.avail}.`}>
                    {pct(wd)}
                  </td>
                  <td
                    className="num"
                    style={{ background: shade(u.rgb, we) }}
                    title={`Friday–Saturday nights: booked ${u.weekend.booked} of ${u.weekend.avail}.${we > wd + 0.15 ? " Weekends are much stronger than weekdays here." : ""}`}
                  >
                    {pct(we)}
                  </td>
                  <td className="num" title={u.lead == null ? "No booking dates available." : `Half of guests booked ${u.lead} days or less before check-in.`}>
                    {u.lead ?? "—"}
                  </td>
                  <td className="num" title={`${pct(u.sameDay)} of stays were booked on the check-in day itself.`}>
                    {u.lead == null ? "—" : pct(u.sameDay)}
                  </td>
                  <td
                    className={`num ${u.orphan >= 8 ? "neg" : ""}`}
                    style={{ background: `rgba(199,69,43,${Math.min(0.5, u.orphan / 40).toFixed(2)})` }}
                    title={`${u.orphan} nights sat empty in short gaps: ${u.gap1} gaps of 1 night and ${u.gap2} gaps of 2 nights. Roughly ${m(u.orphan * u.adr)} of potential earnings.`}
                  >
                    {u.orphan}
                    <div className="muted small">
                      {u.gap1}×1, {u.gap2}×2
                    </div>
                  </td>
                  <td className="num" title={u.ltrShare ? `${pct(u.ltrShare)} of booked nights came from the long-stay listing (${m(u.ltrAmt)}).` : "No long-stay listing or no bookings on it."}>
                    {u.ltrShare ? pct(u.ltrShare) : "—"}
                  </td>
                  <td
                    className={`num ${u.refundRate > 0.05 ? "neg" : ""}`}
                    style={{ background: `rgba(199,69,43,${Math.min(0.6, u.refundRate * 4).toFixed(2)})` }}
                    title={`${m(-u.refund)} refunded or adjusted out of ${m(u.refundBase)} earned.${u.refundRate > 0.05 ? " Above the 5% warning line." : ""}`}
                  >
                    {pct(u.refundRate, 1)}
                  </td>
                  <td className="num" title={`${u.repeatGuests} of ${u.guests} guests stayed here more than once.`}>
                    {u.repeatGuests}
                    <span className="muted">/{u.guests}</span>
                  </td>
                  <td className="num" title={`${u.name} brought in ${m(u.net)}, which is ${pct(u.revShare, 1)} of everything earned.`}>
                    {pct(u.revShare, 1)}
                  </td>
                </tr>
              );
            }}
          />
        </div>
      </Panel>
      <div className="grid two">
        <Panel title="Earnings concentration" sub="Share of total earnings by unit, cumulative">
          <ChartBox config={pareto} label="Earnings by unit with cumulative share" />
          {par.length > 0 && (
            <p className="note">
              {n80} of {par.length} units make 80% of earnings.
              {par.length > 5 && ` Bottom 5 units together: ${pct(par.slice(-5).reduce((a, u) => a + u.net, 0) / (totRev || 1))}.`}
            </p>
          )}
        </Panel>
        <Panel title="Seasonality" sub="Each month vs that area's average month (1.0 = average)">
          <ChartBox config={season} label="Seasonality index by area" />
        </Panel>
      </div>
      <div className="grid two">
        <Panel title="Nightly rate heatmap" sub="Realised rate per night per unit per month">
          <div style={{ overflowX: "auto" }}>
            <Heat
              small
              months={r.monthLabels}
              rows={rows.map((u) => ({
                key: u.id,
                label: u.name,
                sub: u.nickname,
                rgb: u.rgb,
                cells: u.monthAdr.map((v, i) =>
                  v
                    ? { ratio: A.adrMax ? v / A.adrMax : 0, text: `${Math.round(v / 100) / 10}k`, title: `${u.name} ${r.monthLabels[i]}: ${m(v)}/night` }
                    : null
                ),
              }))}
            />
          </div>
        </Panel>
        <Panel title="Repeat guests" sub={`${A.repeatGuests} of ${A.totalGuests} guests came back at least once`}>
          <table className="t">
            <thead>
              <tr>
                <th>Guest</th>
                <th className="num">Stays</th>
              </tr>
            </thead>
            <tbody>
              {A.topRepeat.map((g) => (
                <tr key={g.guest}>
                  <td>{g.guest}</td>
                  <td className="num">{g.stays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

export { NEG };
