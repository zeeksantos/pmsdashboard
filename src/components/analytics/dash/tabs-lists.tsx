"use client";

import { useMemo, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import { CHANNEL_LABELS } from "@/lib/analytics/importers";
import { NEG, POS, type ListingReport } from "@/lib/analytics/report";
import { ChartBox, GRID, kTicks, Ledger, Panel, pct, shortDate, SortTable, tone } from "./ui";
import type { TabProps } from "./types";

const channelName = (c: string) => CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS] ?? c;

// ═══════════════════════════ Listings ═══════════════════════════════════
export function ListingsTab(p: TabProps) {
  const { report: r, m } = p;
  const [area, setArea] = useState("");
  const [bldg, setBldg] = useState("");
  const [q, setQ] = useState("");
  const buildings = [...new Set(r.listings.map((l) => l.building).filter(Boolean))].sort();
  const rows = r.listings.filter(
    (l) =>
      (!area || l.area === area) &&
      (!bldg || l.building === bldg) &&
      (!q || `${l.name} ${l.unitLabel} ${l.building}`.toLowerCase().includes(q.toLowerCase()))
  );
  const maxNet = Math.max(1, ...r.listings.map((l) => l.net));
  const sumBy = (rs: ListingReport[], k: "gross" | "adj" | "fees" | "net" | "nights" | "bookings") => rs.reduce((a, l) => a + l[k], 0);
  return (
    <Panel
      title="Listing performance"
      sub="Every listing from your uploaded exports, with the unit it belongs to. Gross is what guests paid you before channel fees; adjustments are refunds, changes and co-host shares. Click a header to sort."
    >
      <div className="filters">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
          <option value="">All areas</option>
          {r.areas.map((a) => (
            <option key={a.name}>{a.name}</option>
          ))}
        </select>
        <select value={bldg} onChange={(e) => setBldg(e.target.value)} aria-label="Building">
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listing or unit" aria-label="Search listings" />
        <span className="count">
          {rows.length} of {r.listings.length}
        </span>
      </div>
      <div className="table-scroll">
        <SortTable
          rows={rows}
          cols={[
            { key: "name", label: "Listing" },
            { key: "unitLabel", label: "Unit" },
            { key: "model", label: "Model" },
            { key: "gross", label: "Gross", num: true, grp: "money" },
            { key: "adj", label: "Adjustments", num: true, grp: "risk" },
            { key: "fees", label: "Fees", num: true, grp: "risk" },
            { key: "net", label: "Net", num: true, def: "desc", grp: "money" },
            { key: "nights", label: "Nights", num: true, grp: "occ" },
            { key: "bookings", label: "Bookings", num: true, grp: "occ" },
            { key: "avgStay", label: "Avg stay", num: true, grp: "occ" },
            { key: "adr", label: "Per night", num: true, grp: "money" },
          ]}
          render={(l) => (
            <tr key={l.id}>
              <td>
                {l.name}
                <div className="muted small">{channelName(l.channel)}</div>
              </td>
              <td>
                {l.unitId ? (
                  <button type="button" className="tag" style={{ "--area": l.color, cursor: "pointer" } as React.CSSProperties} onClick={() => p.openUnit(l.unitId!)}>
                    {l.building ? `${l.building} ` : ""}
                    {l.unitLabel}
                  </button>
                ) : (
                  <a className="tag warn" href="/analytics/units">
                    Not linked
                  </a>
                )}
              </td>
              <td className="muted">{l.model === "No activity" ? <span className="tag warn">No activity</span> : l.model}</td>
              <td className="num">{m(l.gross)}</td>
              <td className={`num ${tone(l.adj)}`}>{l.adj ? m(l.adj) : "—"}</td>
              <td className={`num ${tone(l.fees)}`}>{l.fees ? m(l.fees) : "—"}</td>
              <td className="num">
                <span className="bar" style={{ width: Math.max(2, (60 * Math.max(0, l.net)) / maxNet), background: l.color }} />
                <b>{m(l.net)}</b>
              </td>
              <td className="num">{l.nights}</td>
              <td className="num">{l.bookings}</td>
              <td className="num">{l.avgStay ? l.avgStay.toFixed(1) : "—"}</td>
              <td className="num">{l.adr ? m(l.adr) : "—"}</td>
            </tr>
          )}
          footer={(rs) => (
            <tr>
              <td colSpan={3}>{rs.length} listings</td>
              <td className="num">{m(sumBy(rs, "gross"))}</td>
              <td className="num">{m(sumBy(rs, "adj"))}</td>
              <td className="num">{m(sumBy(rs, "fees"))}</td>
              <td className="num">{m(sumBy(rs, "net"))}</td>
              <td className="num">{sumBy(rs, "nights")}</td>
              <td className="num">{sumBy(rs, "bookings")}</td>
              <td />
              <td />
            </tr>
          )}
        />
      </div>
    </Panel>
  );
}

// ═══════════════════════════ Co-host ════════════════════════════════════
export function CohostTab(p: TabProps) {
  const { report: r, m, currency } = p;
  const C = r.cohost;
  const [sel, setSel] = useState(0);
  const shared = C.shared[Math.min(sel, Math.max(0, C.shared.length - 1))];
  const chart = useMemo<ChartConfiguration | null>(
    () =>
      shared
        ? {
            type: "bar",
            data: {
              labels: r.monthLabels,
              datasets: [
                { label: "Collected from guests", data: shared.collected, backgroundColor: "#0E8C8E", borderRadius: 3 },
                { label: "Paid to co-host", data: shared.paid, backgroundColor: NEG, borderRadius: 3 },
              ],
            },
            options: {
              plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m(c.raw as number)}` } } },
              scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: kTicks(currency) }, grid: { color: GRID } } },
            },
          }
        : null,
    [shared, r.monthLabels, m, currency]
  );
  if (!C.listings.length && !C.shared.length) {
    return (
      <Panel title="Co-host activity">
        <p className="muted">
          No co-host lines in this period. When you co-host for other hosts — or share a listing&apos;s payout with a co-host — Airbnb&apos;s
          transaction history lists those as &ldquo;Co-Host payout&rdquo; lines, and they&apos;ll show up here.
        </p>
      </Panel>
    );
  }
  const sharedIn = C.shared.reduce((a, s) => a + s.collectedTotal, 0);
  const sharedOut = C.shared.reduce((a, s) => a + s.paidTotal, 0);
  return (
    <>
      <Ledger
        items={[
          ...(C.listings.length
            ? [
                { label: "Co-host share received", value: m(C.received), sub: `${C.listings.length} listing${C.listings.length === 1 ? "" : "s"} you co-host`, kind: "bora" as const },
                { label: "Co-host stays", value: C.stays.toLocaleString(), sub: `${C.nights} nights`, kind: "guest" as const },
                { label: "Per night to you", value: m(C.nights ? C.received / C.nights : 0), sub: "average across co-host units", kind: "money" as const },
                { label: "Channel fees on co-host income", value: m(0), sub: "fees are charged to the primary host", kind: "cost" as const },
              ]
            : []),
          ...(C.shared.length
            ? [
                {
                  label: "Shared listings collected",
                  value: m(sharedIn),
                  sub: `${C.shared.length} listing${C.shared.length === 1 ? "" : "s"} you host and share`,
                  kind: "bora" as const,
                },
                {
                  label: "Paid to co-hosts",
                  value: <span className="neg">{m(sharedOut)}</span>,
                  sub: sharedIn ? `${pct(-sharedOut / sharedIn)} of collected` : "",
                  kind: "cost" as const,
                },
              ]
            : []),
        ]}
      />
      <div className="grid two">
        <Panel title="Co-host share received, by listing" sub="Paid to you as co-host on units you don't host directly">
          {C.listings.length ? (
            <div className="table-scroll">
              <SortTable
                rows={C.listings}
                cols={[
                  { key: "name", label: "Listing" },
                  { key: "unitLabel", label: "Unit" },
                  { key: "bookings", label: "Stays", num: true },
                  { key: "nights", label: "Nights", num: true },
                  { key: "avgStay", label: "Avg stay", num: true },
                  { key: "net", label: "Share", num: true, def: "desc", grp: "money" },
                  { key: "adr", label: "Per night", num: true, grp: "money" },
                ]}
                render={(l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td className="muted">{l.unitId ? `${l.building} ${l.unitLabel}`.trim() : "Not linked"}</td>
                    <td className="num">{l.bookings}</td>
                    <td className="num">{l.nights}</td>
                    <td className="num">{l.avgStay.toFixed(1)}</td>
                    <td className="num">
                      <b>{m(l.net)}</b>
                    </td>
                    <td className="num">{m(l.adr)}</td>
                  </tr>
                )}
                footer={(rs) => (
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="num">{rs.reduce((a, l) => a + l.bookings, 0)}</td>
                    <td className="num">{rs.reduce((a, l) => a + l.nights, 0)}</td>
                    <td />
                    <td className="num">{m(rs.reduce((a, l) => a + l.net, 0))}</td>
                    <td />
                  </tr>
                )}
              />
            </div>
          ) : (
            <p className="muted small">You don&apos;t receive co-host shares on any listing in this period.</p>
          )}
        </Panel>
        <Panel title={shared ? `${shared.listing} — hosted and shared` : "Listings you host and share"} sub="You collect the reservation, then pay a share out to a co-host">
          {shared && chart ? (
            <>
              {C.shared.length > 1 && (
                <div className="filters">
                  <select value={sel} onChange={(e) => setSel(Number(e.target.value))} aria-label="Shared listing">
                    {C.shared.map((s, i) => (
                      <option key={s.listing} value={i}>
                        {s.listing}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <ChartBox config={chart} label={`Collected and paid to co-host by month for ${shared.listing}`} />
              <p className="note">
                Net kept on {shared.listing}: {m(shared.collectedTotal + shared.paidTotal)} over {shared.nights} nights, before {m(shared.adjustments)} in
                refunds and adjustments.
              </p>
            </>
          ) : (
            <p className="muted small">None of your listings pay a share out to a co-host in this period.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

// ═══════════════════════════ Refunds & claims ═══════════════════════════
export function RefundsTab(p: TabProps) {
  const { report: r, m, currency } = p;
  const R = r.refunds;
  const by = [...R.byListing].sort((a, b) => a.amount - b.amount);
  const chart = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: {
        labels: by.map((x) => (x.listing.length > 36 ? x.listing.slice(0, 35) + "…" : x.listing)),
        datasets: [{ data: by.map((x) => x.amount), backgroundColor: by.map((x) => (x.amount < 0 ? NEG : POS)), borderRadius: 3 }],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => m(c.raw as number) } } },
        scales: { x: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [R, m, currency]
  );
  const cur = (row: (typeof R.rows)[number]) =>
    row.currency === currency ? m(row.amountBase) : `${row.amount.toFixed(2)} ${row.currency} (${m(row.amountBase)})`;
  return (
    <>
      <Ledger
        items={[
          { label: "AirCover claims paid to you", value: <span className="pos">{m(R.claims)}</span>, sub: `${R.claimCount} claim${R.claimCount === 1 ? "" : "s"}`, kind: "money" },
          { label: "Resolution payouts (extra fees)", value: <span className="pos">{m(R.resolutionIn)}</span>, sub: "", kind: "money" },
          {
            label: "Resolution adjustments (refunds)",
            value: <span className="neg">{m(R.resolutionOut)}</span>,
            sub: `${R.resolutionOutCount} case${R.resolutionOutCount === 1 ? "" : "s"}`,
            kind: "cost",
          },
          { label: "Other adjustments", value: <span className={tone(R.otherAdjustments)}>{m(R.otherAdjustments)}</span>, sub: "reservation changes, cancellations", kind: "cost" },
          {
            label: "Cancellation fees",
            value: `${m(R.cancellationNet)} net`,
            sub: R.cancellationCount ? `${R.cancellationCount} fee line${R.cancellationCount === 1 ? "" : "s"}` : "none",
            kind: "guest",
          },
          { label: "Net effect", value: <span className={tone(R.net)}>{m(R.net)}</span>, sub: "", kind: R.net < 0 ? "cost" : "money" },
        ]}
      />
      <div className="grid two">
        <Panel title="Refunds, adjustments and claims" sub="Every refund, adjustment and claim in your uploaded exports">
          {R.rows.length ? (
            <div className="table-scroll" style={{ maxHeight: 560 }}>
              <table className="t">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Listing</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {R.rows.map((x) => (
                    <tr key={x.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{shortDate(x.date)}</td>
                      <td>{x.category === "AirCover claim" ? <span className="tag good">AirCover claim</span> : x.category}</td>
                      <td>
                        {x.listing}
                        {x.details && <div className="muted" style={{ fontSize: ".78rem" }}>{x.details}</div>}
                      </td>
                      <td className={`num ${tone(x.amountBase)}`}>{cur(x)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">No refunds, adjustments or claims in this period.</p>
          )}
        </Panel>
        <Panel title="Net effect by listing" sub="Negative means money returned to guests or clawed back">
          {by.length ? <ChartBox config={chart} height={Math.max(260, 26 * by.length + 40)} label="Net refunds and claims by listing" /> : <p className="muted small">Nothing to chart.</p>}
        </Panel>
      </div>
    </>
  );
}

// ═══════════════════════════ All transactions ═══════════════════════════
const PAGE = 300;

export function TransactionsTab(p: TabProps) {
  const { report: r, m, currency } = p;
  const [type, setType] = useState("");
  const [listing, setListing] = useState("");
  const [month, setMonth] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const types = useMemo(() => [...new Set(r.transactions.map((t) => t.type))].sort(), [r]);
  const listings = useMemo(() => [...new Set(r.transactions.map((t) => t.listing).filter(Boolean))].sort(), [r]);
  const sources = useMemo(() => [...new Set(r.transactions.filter((t) => t.kind !== "payout").map((t) => t.source))].sort(), [r]);
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return r.transactions.filter(
      (t) =>
        (!type || t.type === type) &&
        (!listing || t.listing === listing) &&
        (!source || (t.source === source && t.kind !== "payout")) &&
        (month === "" || t.monthIndex === Number(month)) &&
        (!s || `${t.guest} ${t.code} ${t.details} ${t.listing}`.toLowerCase().includes(s))
    );
  }, [r, type, listing, source, month, q]);
  const amt = rows.reduce((a, t) => a + (t.kind === "payout" ? 0 : t.amountBase), 0);
  const paid = rows.reduce((a, t) => a + (t.paidOutBase ?? 0), 0);
  const reset = () => {
    setType("");
    setListing("");
    setMonth("");
    setSource("");
    setQ("");
    setLimit(PAGE);
  };
  const native = (t: (typeof rows)[number], v: number | null) =>
    v == null ? "" : t.currency === currency ? m(v) : `${v.toFixed(2)} ${t.currency}`;
  return (
    <Panel title="All transactions" sub="Every line from your uploaded exports, filterable">
      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={listing} onChange={(e) => setListing(e.target.value)} aria-label="Listing">
          <option value="">All listings</option>
          {listings.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {sources.length > 1 && (
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            {sources.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">All months</option>
          {r.months.map((mo, i) => (
            <option key={mo} value={i}>
              {r.monthLabels[i]} {mo.slice(0, 4)}
            </option>
          ))}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, code, details…" aria-label="Search transactions" />
        <button type="button" className="btn" onClick={reset}>
          Clear filters
        </button>
        <span className="count">
          {rows.length.toLocaleString()} rows · {m(amt)} earned{paid ? ` · ${m(paid)} paid out` : ""}
        </span>
      </div>
      <div className="table-scroll">
        <table className="t">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Source</th>
              <th>Code</th>
              <th>Guest</th>
              <th>Listing</th>
              <th>Stay</th>
              <th className="num">Nights</th>
              <th className="num">Amount</th>
              <th className="num">Paid out</th>
              <th className="num">Fee</th>
              <th className="num">Cleaning</th>
              <th className="num">Gross</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((t) => (
              <tr key={t.id}>
                <td style={{ whiteSpace: "nowrap" }}>{t.date}</td>
                <td>{t.type}</td>
                <td className="muted">
                  {t.kind === "payout" ? "" : t.source}
                  {t.paymentMethod && <div className="small">via {t.paymentMethod}</div>}
                </td>
                <td className="muted">{t.code}</td>
                <td>{t.guest}</td>
                <td>
                  {t.listing || <span className="muted">{t.details}</span>}
                  {t.listing && t.details && <div className="muted" style={{ fontSize: ".76rem" }}>{t.details}</div>}
                </td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {t.checkIn ? `${shortDate(t.checkIn)} – ${shortDate(t.checkOut)}` : ""}
                </td>
                <td className="num">{t.nights ?? ""}</td>
                <td className={`num ${tone(t.amountBase)}`}>
                  {t.currency === currency ? m(t.amount) : `${t.amount.toFixed(2)} ${t.currency}`}
                </td>
                <td className="num">{t.paidOut == null ? "" : native(t, t.paidOut)}</td>
                <td className="num muted">{t.fee ? native(t, t.fee) : ""}</td>
                <td className="num muted">{t.cleaning ? native(t, t.cleaning) : ""}</td>
                <td className="num muted">{t.gross ? native(t, t.gross) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="filters" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => setLimit(limit + PAGE * 3)}>
            Show more ({(rows.length - limit).toLocaleString()} left)
          </button>
        </div>
      )}
    </Panel>
  );
}
