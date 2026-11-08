// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  adr,
  breakEven,
  buildPortfolio,
  computeAlerts,
  monthRange,
  occupancy,
  ownerStatement,
  type TxnInput,
} from "../src/lib/analytics/metrics.ts";

const unit = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  building: null,
  area: "QC",
  owner_id: null,
  active_from: null,
  archived: false,
  ...extra,
});

let n = 0;
const tx = (t: Partial<TxnInput> & Pick<TxnInput, "kind" | "amount_base">): TxnInput => ({
  id: String(++n),
  channel: "airbnb",
  txn_date: t.check_in ?? "2026-01-01",
  check_in: null,
  check_out: null,
  listing_id: "L1",
  confirmation_code: null,
  ...t,
});

const money = (x: number) => `₱${Math.round(x)}`;

test("month helpers", () => {
  assert.deepEqual(monthRange("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("a stay crossing a month end is split by nights; payouts are ignored", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1")],
      listings: [{ id: "L1", unit_id: "U1" }],
      transactions: [
        tx({ kind: "booking", amount_base: 4000, check_in: "2026-01-30", check_out: "2026-02-03", confirmation_code: "A" }),
        tx({ kind: "payout", amount_base: 0, txn_date: "2026-01-31" }),
      ],
      recurringCosts: [],
      expenses: [],
    },
    { from: "2026-01", to: "2026-02" }
  );
  const u = p.units[0];
  assert.equal(u.months["2026-01"].nights, 2);
  assert.equal(u.months["2026-02"].nights, 2);
  assert.equal(u.months["2026-01"].stayRevenue, 2000);
  assert.equal(u.months["2026-02"].stayRevenue, 2000);
  assert.equal(u.months["2026-01"].stays, 1);
  assert.equal(u.months["2026-02"].stays, 0);
  assert.equal(p.totals.netEarnings, 4000);
  assert.equal(adr(u.totals), 1000);
});

test("two listings on one unit and a booking + co-host line never double-count nights", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1")],
      listings: [
        { id: "short", unit_id: "U1" },
        { id: "ltr", unit_id: "U1" },
      ],
      transactions: [
        tx({ kind: "booking", amount_base: 3000, check_in: "2026-03-01", check_out: "2026-03-04", listing_id: "short", confirmation_code: "A" }),
        tx({ kind: "cohost", amount_base: -600, check_in: "2026-03-01", check_out: "2026-03-04", listing_id: "short", confirmation_code: "A" }),
        tx({ kind: "booking", amount_base: 2000, check_in: "2026-03-03", check_out: "2026-03-05", listing_id: "ltr", confirmation_code: "B" }),
      ],
      recurringCosts: [],
      expenses: [],
    },
    { from: "2026-03", to: "2026-03" }
  );
  const s = p.units[0].months["2026-03"];
  assert.equal(s.nights, 4); // Mar 1, 2, 3, 4
  assert.equal(s.stays, 2);
  assert.equal(s.stayRevenue, 4400); // host keeps 3000 − 600 + 2000
});

test("co-host income alone counts as stays (co-host's own export)", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1")],
      listings: [{ id: "L1", unit_id: "U1" }],
      transactions: [tx({ kind: "cohost", amount_base: 1500, check_in: "2026-04-10", check_out: "2026-04-13", confirmation_code: "C" })],
      recurringCosts: [],
      expenses: [],
    },
    { from: "2026-04", to: "2026-04" }
  );
  assert.equal(p.units[0].months["2026-04"].nights, 3);
  assert.equal(p.units[0].months["2026-04"].stays, 1);
});

test("occupancy counts from the unit's start date; unmapped listings go to 'unassigned'", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1", { active_from: "2026-06-16" })],
      listings: [
        { id: "L1", unit_id: "U1" },
        { id: "L2", unit_id: null },
      ],
      transactions: [
        tx({ kind: "booking", amount_base: 5000, check_in: "2026-06-20", check_out: "2026-06-25", confirmation_code: "A" }),
        tx({ kind: "booking", amount_base: 999, check_in: "2026-06-01", check_out: "2026-06-02", listing_id: "L2" }),
        tx({ kind: "payout", amount_base: 0, txn_date: "2026-06-30" }),
      ],
      recurringCosts: [],
      expenses: [],
    },
    { from: "2026-06", to: "2026-06" }
  );
  const s = p.units[0].months["2026-06"];
  assert.equal(s.availableNights, 15); // Jun 16–30
  assert.equal(occupancy(s), 5 / 15);
  assert.equal(p.unassignedTotals.netEarnings, 999);
  assert.equal(p.totals.netEarnings, 5999);
});

test("expenses: recurring costs apply each month in range; one-offs on their month", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1")],
      listings: [{ id: "L1", unit_id: "U1" }],
      transactions: [tx({ kind: "booking", amount_base: 30000, check_in: "2026-01-05", check_out: "2026-01-15", confirmation_code: "A" })],
      recurringCosts: [
        { unit_id: "U1", category: "Rent", monthly_amount: 16500, starts_on: "2026-01-01", ends_on: null },
        { unit_id: "U1", category: "Internet", monthly_amount: 250, starts_on: "2026-02-01", ends_on: "2026-02-28" },
      ],
      expenses: [
        { unit_id: "U1", category: "Repairs", amount: 1200, spent_on: "2026-01-20" },
        { unit_id: null, category: "Software", amount: 500, spent_on: "2026-01-02" },
      ],
    },
    { from: "2026-01", to: "2026-03" }
  );
  const u = p.units[0];
  assert.equal(u.months["2026-01"].expenses, 17700);
  assert.equal(u.months["2026-02"].expenses, 16750);
  assert.equal(u.months["2026-03"].expenses, 16500);
  assert.equal(u.months["2026-01"].profit, 12300);
  assert.equal(p.total["2026-01"].expenses, 18200); // incl. portfolio-wide software
  assert.equal(u.fixedMonthly, 16500); // as of the last month
});

test("break-even: nights needed at the unit's ADR", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1")],
      listings: [{ id: "L1", unit_id: "U1" }],
      transactions: [tx({ kind: "booking", amount_base: 20000, check_in: "2026-01-01", check_out: "2026-01-11", confirmation_code: "A" })],
      recurringCosts: [{ unit_id: "U1", category: "Rent", monthly_amount: 15000, starts_on: "2026-01-01", ends_on: null }],
      expenses: [],
    },
    { from: "2026-01", to: "2026-01" }
  );
  const be = breakEven(p.units[0], p.months);
  assert.equal(be.adr, 2000);
  assert.equal(be.nightsNeeded, 7.5);
  assert.equal(be.avgNights, 10);
  assert.equal(be.cushion, 2.5);
});

test("owner statement: fee on positive earnings only, owner gets the rest", () => {
  const p = buildPortfolio(
    {
      units: [unit("U1", { owner_id: "O1" }), unit("U2", { owner_id: "O1" }), unit("U3", { owner_id: "O2" })],
      listings: [
        { id: "L1", unit_id: "U1" },
        { id: "L2", unit_id: "U2" },
        { id: "L3", unit_id: "U3" },
      ],
      transactions: [
        tx({ kind: "booking", amount_base: 10000, check_in: "2026-05-01", check_out: "2026-05-05", listing_id: "L1", confirmation_code: "A" }),
        tx({ kind: "adjustment", amount_base: -500, txn_date: "2026-05-10", listing_id: "L2" }),
        tx({ kind: "booking", amount_base: 7777, check_in: "2026-05-01", check_out: "2026-05-02", listing_id: "L3", confirmation_code: "C" }),
      ],
      recurringCosts: [{ unit_id: "U1", category: "Cleaning", monthly_amount: 1000, starts_on: "2026-05-01", ends_on: null }],
      expenses: [],
    },
    { from: "2026-05", to: "2026-05" }
  );
  const st = ownerStatement(p, "O1", "2026-05", 20);
  assert.equal(st.lines.length, 2);
  const [u1, u2] = st.lines;
  assert.equal(u1.managementFee, 2000);
  assert.equal(u1.dueToOwner, 7000);
  assert.equal(u2.managementFee, 0);
  assert.equal(u2.dueToOwner, -500);
  assert.equal(st.totals.dueToOwner, 6500);
});

test("alerts: occupancy drop, underpricing, unmapped listings, stale data", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04"];
  const transactions: TxnInput[] = [];
  // U1: busy Jan–Mar, almost empty in April.
  for (const mo of months.slice(0, 3)) {
    transactions.push(tx({ kind: "booking", amount_base: 40000, check_in: `${mo}-01`, check_out: `${mo}-21`, listing_id: "L1", confirmation_code: `U1${mo}` }));
  }
  transactions.push(tx({ kind: "booking", amount_base: 4000, check_in: "2026-04-01", check_out: "2026-04-03", listing_id: "L1", confirmation_code: "U1apr" }));
  // U2: full in April but cheap; U3: pricier peer.
  transactions.push(tx({ kind: "booking", amount_base: 30000, check_in: "2026-04-01", check_out: "2026-05-01", listing_id: "L2", confirmation_code: "U2" }));
  transactions.push(tx({ kind: "booking", amount_base: 30000, check_in: "2026-04-01", check_out: "2026-04-16", listing_id: "L3", confirmation_code: "U3" }));
  transactions.push(tx({ kind: "booking", amount_base: 40000, check_in: "2026-04-01", check_out: "2026-04-21", listing_id: "L1b", confirmation_code: "peer" }));
  transactions.push(tx({ kind: "payout", amount_base: 0, txn_date: "2026-04-30" }));

  const p = buildPortfolio(
    {
      units: [unit("U1", { active_from: "2026-01-01" }), unit("U2", { active_from: "2026-04-01" }), unit("U3", { active_from: "2026-04-01" })],
      listings: [
        { id: "L1", unit_id: "U1" },
        { id: "L2", unit_id: "U2" },
        { id: "L3", unit_id: "U3" },
        { id: "L1b", unit_id: null },
      ],
      transactions,
      recurringCosts: [],
      expenses: [],
    },
    { from: "2026-01", to: "2026-04" }
  );
  const alerts = computeAlerts(p, { today: "2026-06-20", lastImportAt: "2026-05-01", unmappedListings: 1, formatMoney: money });
  const kinds = alerts.map((a) => `${a.kind}:${a.unitId ?? ""}`);
  assert.ok(kinds.includes("occupancy_drop:U1"), kinds.join(" "));
  assert.ok(kinds.includes("underpriced:U2"), kinds.join(" "));
  assert.ok(kinds.includes("unmapped_listings:"), kinds.join(" "));
  assert.ok(kinds.includes("stale_data:"), kinds.join(" "));
  assert.ok(!kinds.includes("underpriced:U3"));
  // Every alert explains itself with numbers.
  for (const a of alerts) assert.ok(a.detail.length > 20);
});
