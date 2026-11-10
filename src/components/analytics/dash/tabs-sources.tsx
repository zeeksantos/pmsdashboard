"use client";

import type { ChartConfiguration } from "chart.js";
import { ChartBox, GRID, kTicks, Ledger, Panel, pct, SortTable } from "./ui";
import type { TabProps } from "./types";

export function SourcesTab(p: TabProps) {
  const { report: r, m, currency, canEdit } = p;
  const S = r.sources;
  const rows = S.rows;
  const top = rows[0];
  const direct = rows.filter((x) => x.direct);
  const ota = rows.filter((x) => !x.direct);
  const adrOf = (xs: typeof rows) => {
    const n = xs.reduce((a, x) => a + x.nights, 0);
    return n ? xs.reduce((a, x) => a + x.adr * x.nights, 0) / n : 0;
  };

  const monthly: ChartConfiguration = {
    type: "bar",
    data: {
      labels: r.monthLabels,
      datasets: S.monthly.map((s) => ({ label: s.label, data: s.values, backgroundColor: s.color, stack: "a", borderRadius: 2 })),
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
  };
  const share: ChartConfiguration = {
    type: "bar",
    data: {
      labels: rows.map((x) => x.label),
      datasets: [{ data: rows.map((x) => x.net), backgroundColor: rows.map((x) => x.color), borderRadius: 3 }],
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${m(c.raw as number)} · ${pct(rows[c.dataIndex].share, 1)}` } },
      },
      scales: { x: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } }, y: { grid: { display: false } } },
    },
  };

  return (
    <>
      <Ledger
        items={[
          {
            label: "Direct bookings",
            value: pct(S.directShare),
            sub: `${m(S.directNet)} from ${S.directStays} stay${S.directStays === 1 ? "" : "s"} you booked yourself`,
            kind: "money",
          },
          { label: "Top source", value: top ? top.label : "—", sub: top ? `${pct(top.share)} of earnings · ${top.stays} stays` : "", kind: "guest" },
          {
            label: "Fees saved by going direct",
            value: S.directStays ? m(S.feesSaved) : "—",
            sub: S.otaFeeRate ? `at your average OTA fee of ${pct(S.otaFeeRate, 1)}` : "no OTA fees to compare with",
            kind: "money",
            title: "What the platforms would have charged on your direct bookings, at the service-fee rate they actually charged you this period.",
          },
          {
            label: "Per night: direct vs OTA",
            value: direct.length && ota.length ? `${m(adrOf(direct))} vs ${m(adrOf(ota))}` : "—",
            sub: "before fees, cleaning excluded",
            kind: "occ",
          },
          { label: "Sources", value: String(rows.length), sub: rows.map((x) => x.label).join(", ") || "—", kind: "guest" },
        ]}
      />
      {!direct.length && (
        <Panel style={{ marginBottom: 20 }}>
          <p className="muted" style={{ margin: 0 }}>
            Only platform bookings so far. Record bookings from Facebook, Instagram, TikTok, Messenger or referrals on{" "}
            {canEdit ? <a href="/analytics/direct">Direct bookings</a> : "the Direct bookings page"} to see how they compare — and how much you save in
            platform fees.
          </p>
        </Panel>
      )}
      <div className="grid two">
        <Panel title="Earnings by source, by month" sub="Where each month's money came from">
          <ChartBox config={monthly} label="Earnings by booking source and month" />
        </Panel>
        <Panel title="Share of earnings" sub="All stays in this period">
          <ChartBox config={share} height={Math.max(220, 34 * rows.length + 40)} label="Earnings by booking source" />
        </Panel>
      </div>
      <Panel title="Every source compared" sub="Click a header to sort. Earnings are after platform or payment fees." style={{ marginTop: 20 }}>
        <div className="table-scroll">
          <SortTable
            rows={rows}
            cols={[
              { key: "label", label: "Source" },
              { key: "stays", label: "Stays", num: true, grp: "occ" },
              { key: "nights", label: "Nights", num: true, grp: "occ" },
              { key: "net", label: "Earnings", num: true, def: "desc", grp: "money" },
              { key: "share", label: "Share", num: true, grp: "money" },
              { key: "adr", label: "Per night", num: true, grp: "money", tip: "Average per booked night before fees, cleaning excluded." },
              { key: "perStay", label: "Per stay", num: true, grp: "money" },
              { key: "avgStay", label: "Avg stay", num: true, grp: "book" },
              { key: "leadMedian", label: "Days booked ahead", num: true, grp: "book", tip: "Typical days between booking and check-in." },
              { key: "fees", label: "Fees", num: true, grp: "risk" },
              { key: "repeatGuests", label: "Returning guests", num: true, grp: "book" },
              { key: "unitCount", label: "Units", num: true },
            ]}
            render={(x) => (
              <tr key={x.label}>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: x.color, display: "inline-block" }} />
                    <b>{x.label}</b>
                  </span>
                  <div className="muted small">{x.direct ? "Direct" : "Platform"}</div>
                </td>
                <td className="num">{x.stays}</td>
                <td className="num">{x.nights}</td>
                <td className="num money">
                  <b>{m(x.net)}</b>
                </td>
                <td className="num">{pct(x.share, 1)}</td>
                <td className="num">{x.adr ? m(x.adr) : "—"}</td>
                <td className="num">{m(x.perStay)}</td>
                <td className="num">{x.avgStay.toFixed(1)}</td>
                <td className="num">{x.leadMedian == null ? "—" : Math.round(x.leadMedian)}</td>
                <td className={`num ${x.fees < -0.5 ? "neg" : "muted"}`}>{x.fees ? m(x.fees) : "—"}</td>
                <td className="num">
                  {x.repeatGuests}
                  <span className="muted">/{x.guests}</span>
                </td>
                <td className="num">{x.unitCount}</td>
              </tr>
            )}
            footer={(xs) => (
              <tr>
                <td>Total</td>
                <td className="num">{xs.reduce((a, x) => a + x.stays, 0)}</td>
                <td className="num">{xs.reduce((a, x) => a + x.nights, 0)}</td>
                <td className="num">{m(xs.reduce((a, x) => a + x.net, 0))}</td>
                <td />
                <td />
                <td />
                <td />
                <td />
                <td className="num">{m(xs.reduce((a, x) => a + x.fees, 0))}</td>
                <td />
                <td />
              </tr>
            )}
          />
        </div>
        <p className="note">
          Platform rows come from your uploaded exports; direct rows from the Direct bookings page or a spreadsheet upload with a Source column.
          Co-host shares count under the platform they came through.
        </p>
      </Panel>
    </>
  );
}
