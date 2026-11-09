// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, type ReportTxn } from "../src/lib/analytics/report.ts";

let n = 0;
const tx = (t: Partial<ReportTxn> & Pick<ReportTxn, "kind" | "amount_base">): ReportTxn => ({
  id: String(++n).padStart(4, "0"),
  raw_type: null,
  channel: "airbnb",
  txn_date: t.check_in ?? "2026-03-01",
  booked_on: null,
  confirmation_code: null,
  guest_name: null,
  check_in: null,
  check_out: null,
  nights: null,
  currency: "PHP",
  amount: t.amount_base,
  fx_rate: 1,
  gross: null,
  service_fee: null,
  cleaning_fee: null,
  paid_out: null,
  details: null,
  listing_id: "L1",
  ...t,
});

const units = [
  { id: "U1", name: "908C", nickname: "Elmo's Tavern", building: "Tower C", area: "Quezon City", owner_id: null, active_from: null, archived: false },
  { id: "U2", name: "8", nickname: null, building: "Beach", area: "Boracay", owner_id: null, active_from: null, archived: false },
];
const listings = [
  { id: "L1", channel: "airbnb", external_name: "Cozy 1BR", unit_id: "U1" },
  { id: "L2", channel: "airbnb", external_name: "Beach Villa", unit_id: "U2" },
  { id: "L3", channel: "airbnb", external_name: "Friend's place", unit_id: "U2" },
];

function build(transactions: ReportTxn[]) {
  return buildReport({
    transactions,
    units,
    listings,
    fixedCosts: [],
    monthlyCosts: [],
    expenses: [],
    from: "2026-03",
    to: "2026-04",
    today: "2026-04-20",
    lastImportAt: "2026-04-15",
    formatMoney: (x) => String(Math.round(x)),
  });
}

test("ledger ties out: gross − fees + adjustments = net; payouts ignored", () => {
  const r = build([
    tx({ kind: "booking", amount_base: 9000, gross: 10000, service_fee: 300, cleaning_fee: 1000, nights: 3, check_in: "2026-03-02", check_out: "2026-03-05", txn_date: "2026-03-03", booked_on: "2026-02-28", guest_name: "Ana", confirmation_code: "A" }),
    tx({ kind: "cohost", amount_base: -4000, check_in: "2026-03-02", check_out: "2026-03-05", txn_date: "2026-03-03", nights: 3, confirmation_code: "A", listing_id: "L2" }),
    tx({ kind: "booking", amount_base: 8000, gross: 8500, service_fee: 250, nights: 2, check_in: "2026-03-10", check_out: "2026-03-12", txn_date: "2026-03-11", listing_id: "L2", guest_name: "Ben", confirmation_code: "B" }),
    tx({ kind: "cohost", amount_base: 1500, nights: 2, check_in: "2026-04-01", check_out: "2026-04-03", txn_date: "2026-04-02", listing_id: "L3", guest_name: "Cy", confirmation_code: "C" }),
    tx({ kind: "resolution", amount_base: -500, txn_date: "2026-04-10", raw_type: "Resolution Adjustment" }),
    tx({ kind: "payout", amount_base: 0, paid_out: 300, currency: "USD", details: "Transfer to PayPal: x (USD)", txn_date: "2026-04-15" }),
  ]);
  const o = r.overview;
  assert.equal(o.net, 9000 - 4000 + 8000 + 1500 - 500);
  assert.equal(o.gross, 10000 + 8500 + 1500);
  assert.equal(o.fees, -550);
  assert.equal(Math.round(o.gross + o.fees + o.adjustments), o.net);
  assert.equal(o.stays, 3);
  assert.deepEqual(o.monthlyNet, [13000, 1000]);
  assert.deepEqual(o.payouts, [{ method: "Transfer to PayPal", currency: "USD", amount: 300, share: 1 }]);
  assert.equal(r.window.start, "2026-03-01");
  assert.equal(r.window.end, "2026-04-15");
  assert.equal(r.window.partialLast, true);

  const models = Object.fromEntries(r.listings.map((l) => [l.name, l.model]));
  assert.deepEqual(models, { "Cozy 1BR": "Primary host", "Beach Villa": "Primary host, shared", "Friend's place": "Co-host" });
  assert.equal(r.cohost.received, 1500);
  assert.equal(r.cohost.shared[0].paidTotal, -4000);

  const u1 = r.units.find((u) => u.id === "U1")!;
  assert.equal(u1.nights, 3);
  assert.equal(u1.adr, (10000 - 1000) / 3);
  assert.equal(u1.lead, 2);
  assert.equal(u1.nickname, "Elmo's Tavern");
  assert.deepEqual(r.areas.map((a) => a.name), ["Quezon City", "Boracay"]); // by earnings
  assert.equal(r.refunds.resolutionOut, -500);
  assert.equal(r.transactions.length, 6);
});

test("gap nights: one- and two-night holes between stays", () => {
  const r = build([
    tx({ kind: "booking", amount_base: 1, nights: 2, check_in: "2026-03-01", check_out: "2026-03-03", txn_date: "2026-03-02", confirmation_code: "1" }),
    tx({ kind: "booking", amount_base: 1, nights: 1, check_in: "2026-03-04", check_out: "2026-03-05", txn_date: "2026-03-05", confirmation_code: "2" }),
    tx({ kind: "booking", amount_base: 1, nights: 1, check_in: "2026-03-07", check_out: "2026-03-08", txn_date: "2026-03-08", confirmation_code: "3" }),
    tx({ kind: "booking", amount_base: 1, nights: 1, check_in: "2026-03-20", check_out: "2026-03-21", txn_date: "2026-03-31", confirmation_code: "4" }),
  ]);
  const u1 = r.units.find((u) => u.id === "U1")!;
  assert.equal(u1.gap1, 1); // Mar 3
  assert.equal(u1.gap2, 1); // Mar 5–6
  assert.equal(u1.orphan, 3);
  assert.equal(u1.nights, 5);
});
