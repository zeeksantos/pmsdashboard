"use client";

import { useState } from "react";
import type { ChartConfiguration } from "chart.js";
import { INK } from "@/lib/analytics/report";
import type { StayStatus } from "@/lib/analytics/upcoming";
import { ChartBox, GRID, kTicks, Ledger, Panel, pct, shortDate } from "./ui";
import { Heat } from "./tabs-overview";
import type { TabProps } from "./types";

const STATUS: Record<StayStatus, { label: string; cls: string }> = {
  staying: { label: "Staying now", cls: "good" },
  upcoming: { label: "Upcoming", cls: "" },
  awaiting: { label: "Checked out · payout pending", cls: "warn" },
};

const longDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

export function UpcomingTab(p: TabProps) {
  const { upcoming: u, m, currency, canEdit } = p;
  const [group, setGroup] = useState("");

  if (!u.count) {
    return (
      <Panel title="Upcoming bookings">
        <p className="muted">
          Nothing on the books yet. Upload Airbnb&apos;s <b>pending</b> export to see reservations that haven&apos;t paid out: Menu → Earnings →
          Transaction history, switch to upcoming payouts, then Export CSV. They stay out of your earnings until the paid version is uploaded.
        </p>
        {canEdit && (
          <p style={{ marginTop: 12 }}>
            <a className="btn dark" href="/analytics/import">
              Upload an export
            </a>
          </p>
        )}
      </Panel>
    );
  }

  const chart: ChartConfiguration = {
    type: "bar",
    data: {
      labels: u.monthLabels,
      datasets: [
        { type: "bar", label: "Booked earnings", data: u.monthly.net, backgroundColor: INK, borderRadius: 3, yAxisID: "y" },
        { type: "line", label: "Nights booked", data: u.monthly.nights, borderColor: "#0E8C8E", backgroundColor: "#0E8C8E", tension: 0.3, pointRadius: 3, yAxisID: "y1" },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (c) => (c.dataset.yAxisID === "y1" ? `${c.raw} nights` : `${c.dataset.label}: ${m(c.raw as number)}`) } },
      },
      scales: {
        y: { ticks: { callback: kTicks(currency) }, grid: { color: GRID } },
        y1: { position: "right", grid: { display: false }, title: { display: true, text: "nights" } },
        x: { grid: { display: false } },
      },
    },
  };

  const groups = u.groups;
  const rows = u.stays.filter((s) => !group || s.group === group);
  const total = rows.reduce((a, s) => a + s.net, 0);
  const nights = rows.reduce((a, s) => a + s.nights, 0);
  const firstOpen = u.monthAvail.findIndex((a) => a > 0);

  return (
    <>
      <Ledger
        items={[
          { label: "Booked earnings", value: m(u.net), sub: `${u.count} upcoming booking${u.count === 1 ? "" : "s"}, after channel fees`, kind: "money" },
          { label: "Nights on the books", value: u.nights.toLocaleString(), sub: `avg stay ${u.avgStay.toFixed(1)} nights`, kind: "occ" },
          {
            label: "Next 30 days",
            value: pct(u.next30.rate),
            sub: `${u.next30.nights} of ${u.next30.avail} nights booked`,
            kind: "occ",
            title: "Nights already booked in the next 30 days ÷ nights available, across the units with upcoming bookings.",
          },
          { label: "Next 90 days", value: pct(u.next90.rate), sub: `${u.next90.nights} of ${u.next90.avail} nights booked`, kind: "occ" },
          { label: "Average per night", value: u.adr ? m(u.adr) : "—", sub: "before fees, cleaning excluded", kind: "money" },
          {
            label: "Booked ahead (typical)",
            value: u.leadMedian == null ? "—" : `${Math.round(u.leadMedian)} days`,
            sub: u.furthest ? `furthest stay ends ${longDate(u.furthest)}` : "",
            kind: "guest",
          },
        ]}
      />
      <div className="grid two">
        <Panel title="On the books, by month" sub="Booked earnings and nights, split across the months the guests stay">
          <ChartBox config={chart} label="Booked earnings and nights by future month" />
          <p className="note">
            These bookings haven&apos;t paid out, so they&apos;re not in your earnings yet. Each one moves there automatically when you upload the
            Transaction history that includes its payout. Upload a newer pending export to drop cancellations.
          </p>
        </Panel>
        <Panel title="How full each unit is" sub="Share of the remaining nights already booked, per month">
          <div style={{ overflowX: "auto" }}>
            <Heat
              months={u.monthLabels}
              rows={groups.map((g) => ({
                key: g.key,
                label: g.name,
                sub: g.sub,
                rgb: g.rgb,
                cells: g.monthNights.map((n, i) => {
                  const avail = u.monthAvail[i];
                  if (!avail) return null;
                  const ratio = n / avail;
                  return { ratio, text: n ? String(Math.round(100 * ratio)) : "0", title: `${g.name} ${u.monthLabels[i]}: ${n} of ${avail} nights booked` };
                }),
              }))}
            />
          </div>
          {u.unlinked > 0 && (
            <p className="note">
              {u.unlinked} listing{u.unlinked === 1 ? " isn't" : "s aren't"} linked to a unit yet, so {u.unlinked === 1 ? "it shows" : "they show"} by listing
              name. Link {u.unlinked === 1 ? "it" : "them"} on <a href="/analytics/units">Unit setup</a>.
            </p>
          )}
          {firstOpen > 0 && <p className="note">Months already over show “—”; those bookings are just waiting for their payout.</p>}
        </Panel>
      </div>
      <Panel title="Upcoming stays" sub="Every booking from your pending export, soonest first" style={{ marginTop: 20 }}>
        <div className="filters">
          {groups.length > 1 && (
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Unit">
              <option value="">All units</option>
              {groups.map((g) => (
                <option key={g.key} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          <span className="count">
            {rows.length} booking{rows.length === 1 ? "" : "s"} · {nights} nights · {m(total)}
          </span>
        </div>
        <div className="table-scroll">
          <table className="t">
            <thead>
              <tr>
                <th>Check-in</th>
                <th>Check-out</th>
                <th className="num">Nights</th>
                <th>Guest</th>
                <th>Unit / listing</th>
                <th>Booked</th>
                <th className="num">Days ahead</th>
                <th className="num">Per night</th>
                <th className="num">Earnings</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{longDate(s.checkIn)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{longDate(s.checkOut)}</td>
                  <td className="num">{s.nights}</td>
                  <td>
                    {s.guest}
                    <div className="muted small">
                      {s.source}
                      {s.code ? ` · ${s.code}` : ""}
                    </div>
                  </td>
                  <td>
                    <b>{s.group}</b>
                    {s.listing && s.listing !== s.group && <div className="muted small">{s.listing}</div>}
                  </td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {s.bookedOn ? shortDate(s.bookedOn) : "—"}
                  </td>
                  <td className="num">{s.lead ?? "—"}</td>
                  <td className="num">{m(s.perNight)}</td>
                  <td className="num money">
                    <b>{m(s.net)}</b>
                    {s.gross != null && <div className="muted small">{m(s.gross)} gross</div>}
                  </td>
                  <td>
                    <span className={`tag ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                    {s.source === "Airbnb" && <div className="muted small">payout {shortDate(s.payoutDate)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num">{nights}</td>
                <td colSpan={5} />
                <td className="num">{m(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
}
