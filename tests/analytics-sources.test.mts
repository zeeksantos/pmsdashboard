// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, type ReportTxn } from "../src/lib/analytics/report.ts";
import { normaliseSource, sourceOf } from "../src/lib/analytics/sources.ts";
import { parseExport } from "../src/lib/analytics/importers.ts";

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

const units = [{ id: "U1", name: "Studio", nickname: null, building: "Bori", area: "Boracay", owner_id: null, active_from: null, archived: false }];
const listings = [
  { id: "L1", channel: "airbnb", external_name: "Studio | D'mall", unit_id: "U1" },
  { id: "D1", channel: "direct", external_name: "Direct · Studio", unit_id: "U1" },
];

const build = (transactions: ReportTxn[]) =>
  buildReport({
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

test("source names are tidied into the known labels", () => {
  assert.equal(normaliseSource("fb page"), "Facebook");
  assert.equal(normaliseSource(" IG "), "Instagram");
  assert.equal(normaliseSource("Tik Tok"), "TikTok");
  assert.equal(normaliseSource("walk in"), "Walk-in");
  assert.equal(normaliseSource("travel agent"), "Travel agent");
  assert.equal(normaliseSource(""), null);
  assert.equal(sourceOf("airbnb", null), "Airbnb");
  assert.equal(sourceOf("booking", null), "Booking.com");
  assert.equal(sourceOf("direct", "Instagram"), "Instagram");
});

test("direct bookings count as stays, are split by source, and show fees saved", () => {
  const r = build([
    // Airbnb: ₱10,000 gross, ₱1,500 fee (15%)
    tx({ kind: "booking", amount_base: 8500, gross: 10000, service_fee: 1500, nights: 4, check_in: "2026-03-02", check_out: "2026-03-06", txn_date: "2026-03-06", guest_name: "Ana" }),
    // Facebook direct: ₱6,000 paid by GCash, no fees
    tx({ kind: "booking", channel: "direct", listing_id: "D1", amount_base: 6000, amount: 6000, gross: 6000, service_fee: 0, nights: 3, check_in: "2026-03-10", check_out: "2026-03-13", txn_date: "2026-03-01", booked_on: "2026-03-01", guest_name: "Ben", source: "Facebook", payment_method: "GCash" }),
    // Instagram direct, ₱100 transfer fee
    tx({ kind: "booking", channel: "direct", listing_id: "D1", amount_base: 3900, amount: 3900, gross: 4000, service_fee: 100, nights: 2, check_in: "2026-04-01", check_out: "2026-04-03", guest_name: "Cy", source: "Instagram", payment_method: "Maya" }),
    // Future direct stay: Upcoming tab, not earnings
    tx({ kind: "booking", channel: "direct", listing_id: "D1", amount_base: 5000, gross: 5000, nights: 2, check_in: "2026-04-25", check_out: "2026-04-27", source: "TikTok" }),
  ]);
  assert.equal(r.overview.net, 18400);
  assert.equal(r.overview.stays, 3);
  const labels = r.sources.rows.map((x) => x.label);
  assert.deepEqual(labels, ["Airbnb", "Facebook", "Instagram"]);
  assert.equal(r.sources.directNet, 9900);
  assert.equal(Math.round(r.sources.directShare * 1000), Math.round((9900 / 18400) * 1000));
  assert.equal(r.sources.otaFeeRate, 0.15);
  assert.equal(r.sources.feesSaved, 10000 * 0.15);
  const fb = r.sources.rows.find((x) => x.label === "Facebook")!;
  assert.equal(fb.adr, 2000);
  assert.equal(fb.leadMedian, 9);
  // the direct listing counts toward the unit, and payment methods show up
  assert.equal(r.units[0].net, 18400);
  assert.ok(r.overview.payouts.some((p) => p.method === "GCash" && p.amount === 6000));
  assert.equal(r.listings.find((l) => l.id === "D1")!.model, "Direct");
  assert.equal(r.transactions.find((t) => t.source === "Instagram")!.paymentMethod, "Maya");
});

test("a spreadsheet of direct bookings maps its Source column", () => {
  const csv = `Guest,Check-in,Check-out,Amount,Source,Room
Ana,2026-03-01,2026-03-03,5000,FB,Studio
Ben,2026-03-05,2026-03-08,7200,ig,Studio
`;
  const r = parseExport(csv, { channel: "other" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map((x) => x.source), ["Facebook", "Instagram"]);
});
