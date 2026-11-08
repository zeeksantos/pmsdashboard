// Portfolio metrics computed from normalised transactions, units, listings
// and expenses. Pure functions: every number on every analytics page comes
// from buildPortfolio() over the same rows the Transactions page lists.
//
// Accounting rules
// - Earnings = sum of transaction amounts (in the workspace's base currency)
//   except payouts, which are bank transfers of money already counted.
// - Stay-linked lines (bookings, co-host payouts, adjustments, resolutions)
//   are spread evenly over the stay's nights, so a stay crossing a month end
//   is split between both months. Everything else lands on its txn date.
// - Stay revenue = bookings + co-host payouts. A co-host's export has only
//   "Co-Host payout" lines for the stays they manage (that's their income);
//   a host who pays a co-host sees a negative one, so stay revenue is what
//   the host actually keeps per night.
// - Occupied nights come from booking and co-host lines, de-duplicated per
//   date, so two listings on one unit (short-stay + long-term), a long stay
//   paid in several lines, or a booking plus its co-host line never
//   double-count a night. Stays = distinct confirmation codes.
// - Occupancy = occupied nights ÷ nights the unit was operating, from its
//   start (active_from, else first stay) to the end of the data.

import { addDays } from "./values.ts";

export type Kind =
  | "booking"
  | "payout"
  | "adjustment"
  | "resolution"
  | "cancellation"
  | "cohost"
  | "tax"
  | "other";

export interface TxnInput {
  id: string;
  kind: Kind;
  channel: string;
  txn_date: string;
  check_in: string | null;
  check_out: string | null;
  amount_base: number;
  listing_id: string | null;
  confirmation_code: string | null;
}

export interface UnitInput {
  id: string;
  name: string;
  building: string | null;
  area: string | null;
  owner_id: string | null;
  active_from: string | null;
  archived: boolean;
}

export interface ListingInput {
  id: string;
  unit_id: string | null;
}

export interface RecurringCostInput {
  unit_id: string;
  category: string;
  monthly_amount: number;
  starts_on: string;
  ends_on: string | null;
}

export interface ExpenseInput {
  unit_id: string | null;
  category: string;
  amount: number;
  spent_on: string;
}

export interface MonthStats {
  nights: number;
  availableNights: number;
  stays: number;
  /** Earnings from bookings and co-host payouts (spread over nights). */
  stayRevenue: number;
  /** Adjustments, resolutions, cancellation fees, taxes… */
  otherRevenue: number;
  netEarnings: number;
  expenses: number;
  profit: number;
  expensesByCategory: Record<string, number>;
}

export interface UnitStats {
  unit: UnitInput;
  months: Record<string, MonthStats>;
  totals: MonthStats;
  firstNight: string | null;
  lastNight: string | null;
  /** Monthly fixed costs currently configured. */
  fixedMonthly: number;
}

export interface Portfolio {
  months: string[];
  units: UnitStats[];
  /** Earnings from listings not yet matched to a unit. */
  unassigned: Record<string, MonthStats>;
  unassignedTotals: MonthStats;
  /** Expenses not tied to a unit (software, accountant…). */
  portfolioExpenses: Record<string, number>;
  total: Record<string, MonthStats>;
  totals: MonthStats;
  byChannel: Record<string, number>;
  byKind: Record<string, number>;
  dataEnd: string | null;
}

export function emptyStats(): MonthStats {
  return {
    nights: 0,
    availableNights: 0,
    stays: 0,
    stayRevenue: 0,
    otherRevenue: 0,
    netEarnings: 0,
    expenses: 0,
    profit: 0,
    expensesByCategory: {},
  };
}

export function occupancy(s: MonthStats): number | null {
  return s.availableNights > 0 ? Math.min(1, s.nights / s.availableNights) : null;
}

export function adr(s: MonthStats): number | null {
  return s.nights > 0 ? s.stayRevenue / s.nights : null;
}

function addInto(target: MonthStats, s: MonthStats) {
  target.nights += s.nights;
  target.availableNights += s.availableNights;
  target.stays += s.stays;
  target.stayRevenue += s.stayRevenue;
  target.otherRevenue += s.otherRevenue;
  target.netEarnings += s.netEarnings;
  target.expenses += s.expenses;
  target.profit += s.profit;
  for (const [k, v] of Object.entries(s.expensesByCategory)) {
    target.expensesByCategory[k] = (target.expensesByCategory[k] ?? 0) + v;
  }
}

// ── month helpers (all string-based, no time zones involved) ─────────────

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function daysBetweenInclusive(a: string, b: string): number {
  if (b < a) return 0;
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000) + 1;
}

const STAY_SPREAD_KINDS = new Set<Kind>(["booking", "cohost", "adjustment", "resolution"]);
const STAY_KINDS = new Set<Kind>(["booking", "cohost"]);

// ── main ─────────────────────────────────────────────────────────────────

export interface BuildOptions {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
}

export function buildPortfolio(
  input: {
    transactions: TxnInput[];
    units: UnitInput[];
    listings: ListingInput[];
    recurringCosts: RecurringCostInput[];
    expenses: ExpenseInput[];
  },
  { from, to }: BuildOptions
): Portfolio {
  const months = monthRange(from, to);
  const monthSet = new Set(months);
  const unitByListing = new Map(input.listings.map((l) => [l.id, l.unit_id]));
  const unitIds = new Set(input.units.map((u) => u.id));

  const unitMonths = new Map<string, Record<string, MonthStats>>();
  for (const u of input.units) {
    unitMonths.set(u.id, Object.fromEntries(months.map((mo) => [mo, emptyStats()])));
  }
  const unassigned: Record<string, MonthStats> = Object.fromEntries(months.map((mo) => [mo, emptyStats()]));
  const byChannel: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const nightsByUnit = new Map<string, Set<string>>();
  const unitFirstNight = new Map<string, string>();
  const unitLastNight = new Map<string, string>();
  const staysCounted = new Set<string>();
  let dataEnd: string | null = null;

  const bucketFor = (unitId: string | null, month: string): MonthStats | null => {
    if (!monthSet.has(month)) return null;
    if (unitId && unitIds.has(unitId)) return unitMonths.get(unitId)![month];
    return unassigned[month];
  };

  for (const t of input.transactions) {
    if (!dataEnd || t.txn_date > dataEnd) dataEnd = t.txn_date;
    if (t.kind === "payout") continue;

    const unitId = t.listing_id ? unitByListing.get(t.listing_id) ?? null : null;
    const amount = Number(t.amount_base) || 0;

    // Occupied nights (whole data range, used for unit start dates too).
    if (STAY_KINDS.has(t.kind) && t.check_in && t.check_out && t.check_out > t.check_in && unitId) {
      let set = nightsByUnit.get(unitId);
      if (!set) nightsByUnit.set(unitId, (set = new Set()));
      for (let d = t.check_in; d < t.check_out; d = addDays(d, 1)) set.add(d);
      const last = addDays(t.check_out, -1);
      if (!unitFirstNight.has(unitId) || t.check_in < unitFirstNight.get(unitId)!) unitFirstNight.set(unitId, t.check_in);
      if (!unitLastNight.has(unitId) || last > unitLastNight.get(unitId)!) unitLastNight.set(unitId, last);
    }

    const spread =
      STAY_SPREAD_KINDS.has(t.kind) && t.check_in && t.check_out && t.check_out > t.check_in;
    if (spread) {
      // Spread evenly over the stay's nights, grouped by month.
      const perMonth = new Map<string, number>();
      let total = 0;
      for (let d = t.check_in!; d < t.check_out!; d = addDays(d, 1)) {
        const mo = monthOf(d);
        perMonth.set(mo, (perMonth.get(mo) ?? 0) + 1);
        total++;
      }
      for (const [mo, n] of perMonth) {
        const share = (amount * n) / total;
        const bucket = bucketFor(unitId, mo);
        if (!bucket) continue;
        if (STAY_KINDS.has(t.kind)) bucket.stayRevenue += share;
        else bucket.otherRevenue += share;
        bucket.netEarnings += share;
        byChannel[t.channel] = (byChannel[t.channel] ?? 0) + share;
        byKind[t.kind] = (byKind[t.kind] ?? 0) + share;
      }
      if (STAY_KINDS.has(t.kind)) {
        const stayKey = `${unitId ?? "-"}|${t.confirmation_code ?? t.id}`;
        if (!staysCounted.has(stayKey)) {
          staysCounted.add(stayKey);
          const b = bucketFor(unitId, monthOf(t.check_in!));
          if (b) b.stays += 1;
        }
      }
    } else {
      const bucket = bucketFor(unitId, monthOf(t.txn_date));
      if (!bucket) continue;
      if (STAY_KINDS.has(t.kind)) bucket.stayRevenue += amount;
      else bucket.otherRevenue += amount;
      bucket.netEarnings += amount;
      byChannel[t.channel] = (byChannel[t.channel] ?? 0) + amount;
      byKind[t.kind] = (byKind[t.kind] ?? 0) + amount;
    }
  }

  // Nights and available nights per unit-month.
  for (const u of input.units) {
    const stats = unitMonths.get(u.id)!;
    const nights = nightsByUnit.get(u.id) ?? new Set<string>();
    for (const d of nights) {
      const s = stats[monthOf(d)];
      if (s) s.nights += 1;
    }
    const start = u.active_from ?? unitFirstNight.get(u.id) ?? null;
    const lastNight = unitLastNight.get(u.id) ?? null;
    const end = [dataEnd, lastNight].filter(Boolean).sort().pop() ?? null;
    if (!start || !end) continue;
    for (const mo of months) {
      const a = start > monthStart(mo) ? start : monthStart(mo);
      const b = end < monthEnd(mo) ? end : monthEnd(mo);
      stats[mo].availableNights = daysBetweenInclusive(a, b);
    }
  }

  // Expenses.
  const portfolioExpenses: Record<string, number> = Object.fromEntries(months.map((mo) => [mo, 0]));
  const addExpense = (unitId: string | null, mo: string, category: string, amount: number) => {
    if (!monthSet.has(mo) || !amount) return;
    if (unitId && unitMonths.has(unitId)) {
      const s = unitMonths.get(unitId)![mo];
      s.expenses += amount;
      s.expensesByCategory[category] = (s.expensesByCategory[category] ?? 0) + amount;
    } else {
      portfolioExpenses[mo] += amount;
    }
  };
  for (const c of input.recurringCosts) {
    const first = monthOf(c.starts_on);
    const last = c.ends_on ? monthOf(c.ends_on) : months[months.length - 1];
    for (const mo of months) {
      if (mo >= first && mo <= last) addExpense(c.unit_id, mo, c.category, Number(c.monthly_amount));
    }
  }
  for (const e of input.expenses) addExpense(e.unit_id, monthOf(e.spent_on), e.category, Number(e.amount));

  // Profit and totals.
  const units: UnitStats[] = input.units.map((u) => {
    const stats = unitMonths.get(u.id)!;
    const totals = emptyStats();
    for (const mo of months) {
      stats[mo].profit = stats[mo].netEarnings - stats[mo].expenses;
      addInto(totals, stats[mo]);
    }
    const lastMonth = months[months.length - 1];
    const fixedMonthly = input.recurringCosts
      .filter(
        (c) =>
          c.unit_id === u.id &&
          monthOf(c.starts_on) <= lastMonth &&
          (!c.ends_on || monthOf(c.ends_on) >= lastMonth)
      )
      .reduce((s, c) => s + Number(c.monthly_amount), 0);
    return {
      unit: u,
      months: stats,
      totals,
      firstNight: unitFirstNight.get(u.id) ?? null,
      lastNight: unitLastNight.get(u.id) ?? null,
      fixedMonthly,
    };
  });

  const unassignedTotals = emptyStats();
  for (const mo of months) {
    unassigned[mo].profit = unassigned[mo].netEarnings;
    addInto(unassignedTotals, unassigned[mo]);
  }

  const total: Record<string, MonthStats> = {};
  const totals = emptyStats();
  for (const mo of months) {
    const s = emptyStats();
    for (const u of units) addInto(s, u.months[mo]);
    addInto(s, unassigned[mo]);
    s.expenses += portfolioExpenses[mo];
    if (portfolioExpenses[mo]) {
      s.expensesByCategory["Portfolio-wide"] = (s.expensesByCategory["Portfolio-wide"] ?? 0) + portfolioExpenses[mo];
    }
    s.profit = s.netEarnings - s.expenses;
    total[mo] = s;
    addInto(totals, s);
  }

  return {
    months,
    units,
    unassigned,
    unassignedTotals,
    portfolioExpenses,
    total,
    totals,
    byChannel,
    byKind,
    dataEnd,
  };
}

// ── Break-even ───────────────────────────────────────────────────────────

export interface BreakEven {
  fixedMonthly: number;
  adr: number | null;
  /** Nights per month needed to cover fixed costs at the unit's ADR. */
  nightsNeeded: number | null;
  avgNights: number;
  /** avgNights − nightsNeeded: positive means comfortably above break-even. */
  cushion: number | null;
}

export function breakEven(u: UnitStats, months: string[]): BreakEven {
  const operating = months.filter((mo) => u.months[mo].availableNights > 0);
  const avgNights = operating.length
    ? operating.reduce((s, mo) => s + u.months[mo].nights, 0) / operating.length
    : 0;
  const unitAdr = adr(u.totals);
  const nightsNeeded = unitAdr && unitAdr > 0 ? u.fixedMonthly / unitAdr : null;
  return {
    fixedMonthly: u.fixedMonthly,
    adr: unitAdr,
    nightsNeeded,
    avgNights,
    cushion: nightsNeeded == null ? null : avgNights - nightsNeeded,
  };
}

// ── Owner statements (manager workspaces) ────────────────────────────────

export interface StatementLine {
  unit: UnitInput;
  nights: number;
  stays: number;
  occupancy: number | null;
  stayRevenue: number;
  otherRevenue: number;
  netEarnings: number;
  expenses: number;
  expensesByCategory: Record<string, number>;
  managementFee: number;
  dueToOwner: number;
}

export interface OwnerStatement {
  month: string;
  lines: StatementLine[];
  totals: Omit<StatementLine, "unit" | "occupancy" | "expensesByCategory"> & { expensesByCategory: Record<string, number> };
}

/**
 * Management fee = fee % of the unit's net channel earnings for the month
 * (never charged on a negative month). Owner gets earnings − expenses − fee.
 */
export function ownerStatement(p: Portfolio, ownerId: string, month: string, feePct: number): OwnerStatement {
  const lines: StatementLine[] = p.units
    .filter((u) => u.unit.owner_id === ownerId)
    .map((u) => {
      const s = u.months[month] ?? emptyStats();
      const managementFee = Math.max(0, s.netEarnings) * (feePct / 100);
      return {
        unit: u.unit,
        nights: s.nights,
        stays: s.stays,
        occupancy: occupancy(s),
        stayRevenue: s.stayRevenue,
        otherRevenue: s.otherRevenue,
        netEarnings: s.netEarnings,
        expenses: s.expenses,
        expensesByCategory: s.expensesByCategory,
        managementFee,
        dueToOwner: s.netEarnings - s.expenses - managementFee,
      };
    });
  const totals = {
    nights: 0,
    stays: 0,
    stayRevenue: 0,
    otherRevenue: 0,
    netEarnings: 0,
    expenses: 0,
    managementFee: 0,
    dueToOwner: 0,
    expensesByCategory: {} as Record<string, number>,
  };
  for (const l of lines) {
    totals.nights += l.nights;
    totals.stays += l.stays;
    totals.stayRevenue += l.stayRevenue;
    totals.otherRevenue += l.otherRevenue;
    totals.netEarnings += l.netEarnings;
    totals.expenses += l.expenses;
    totals.managementFee += l.managementFee;
    totals.dueToOwner += l.dueToOwner;
    for (const [k, v] of Object.entries(l.expensesByCategory)) {
      totals.expensesByCategory[k] = (totals.expensesByCategory[k] ?? 0) + v;
    }
  }
  return { month, lines, totals };
}

// ── Alerts ───────────────────────────────────────────────────────────────

export type AlertSeverity = "high" | "medium" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  kind:
    | "occupancy_drop"
    | "underpriced"
    | "overpriced"
    | "losing_money"
    | "no_recent_bookings"
    | "unmapped_listings"
    | "stale_data"
    | "below_break_even";
  unitId: string | null;
  title: string;
  detail: string;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export interface AlertContext {
  today: string; // YYYY-MM-DD (Manila)
  lastImportAt: string | null; // YYYY-MM-DD
  unmappedListings: number;
  formatMoney: (n: number) => string;
}

/**
 * Rules are deliberately simple and explainable — each alert says exactly
 * which numbers triggered it so a host can sanity-check it.
 */
export function computeAlerts(p: Portfolio, ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const money = ctx.formatMoney;

  if (ctx.unmappedListings > 0) {
    alerts.push({
      id: "unmapped",
      severity: "medium",
      kind: "unmapped_listings",
      unitId: null,
      title: `${ctx.unmappedListings} listing${ctx.unmappedListings === 1 ? "" : "s"} not linked to a unit`,
      detail: `${money(p.unassignedTotals.netEarnings)} of earnings isn't counted in any unit's occupancy or profit until the listing is linked.`,
    });
  }

  if (!ctx.lastImportAt) {
    alerts.push({
      id: "no-data",
      severity: "info",
      kind: "stale_data",
      unitId: null,
      title: "No exports uploaded yet",
      detail: "Upload your Airbnb, Booking.com or Agoda earnings CSV to see your numbers.",
    });
  } else {
    const ageDays = Math.round((Date.parse(ctx.today) - Date.parse(ctx.lastImportAt)) / 86_400_000);
    if (ageDays > 35) {
      alerts.push({
        id: "stale",
        severity: "medium",
        kind: "stale_data",
        unitId: null,
        title: "Your data is getting old",
        detail: `The last export was uploaded ${ageDays} days ago. Upload the latest CSV so alerts reflect what's happening now.`,
      });
    }
  }

  if (!p.dataEnd) return alerts;

  // "Recent" = the last full month the data covers; baseline = the three
  // months before it.
  const dataMonth = monthOf(p.dataEnd);
  const recent = p.dataEnd >= monthEnd(dataMonth) ? dataMonth : shiftMonth(dataMonth, -1);
  const baseline = [1, 2, 3].map((n) => shiftMonth(recent, -n));
  const active = p.units.filter((u) => !u.unit.archived);

  const recentAdr = new Map<string, number>();
  for (const u of active) {
    const s = u.months[recent];
    const a = s ? adr(s) : null;
    if (a != null) recentAdr.set(u.unit.id, a);
  }

  for (const u of active) {
    const s = u.months[recent];
    if (!s || s.availableNights === 0) continue;
    const occ = occupancy(s) ?? 0;
    const name = u.unit.name;
    const monthLabel = labelMonth(recent);

    // Occupancy drop vs the previous three months.
    const base = baseline.map((mo) => u.months[mo]).filter((x): x is MonthStats => !!x && x.availableNights > 0);
    if (base.length >= 2) {
      const baseOcc = base.reduce((t, x) => t + (occupancy(x) ?? 0), 0) / base.length;
      if (baseOcc - occ >= 0.15) {
        alerts.push({
          id: `drop-${u.unit.id}`,
          severity: baseOcc - occ >= 0.3 ? "high" : "medium",
          kind: "occupancy_drop",
          unitId: u.unit.id,
          title: `${name}: occupancy fell to ${pct(occ)}`,
          detail: `${monthLabel} occupancy was ${pct(occ)}, down from a ${pct(baseOcc)} average over the previous ${base.length} months. Check the listing's ranking, reviews and price against nearby units.`,
        });
      }
    }

    // Pricing vs peers in the same area (or the whole portfolio).
    const peers = active.filter(
      (o) => o.unit.id !== u.unit.id && (u.unit.area ? o.unit.area === u.unit.area : true)
    );
    const peerAdr = median(peers.map((o) => recentAdr.get(o.unit.id)).filter((x): x is number => x != null));
    const myAdr = recentAdr.get(u.unit.id) ?? null;
    if (peerAdr && myAdr) {
      const where = u.unit.area ? `other ${u.unit.area} units` : "your other units";
      if (occ >= 0.85 && myAdr < peerAdr * 0.9) {
        alerts.push({
          id: `under-${u.unit.id}`,
          severity: "medium",
          kind: "underpriced",
          unitId: u.unit.id,
          title: `${name}: likely underpriced`,
          detail: `Booked ${pct(occ)} of ${monthLabel} at ${money(myAdr)}/night, while ${where} averaged ${money(peerAdr)}. Try raising the nightly rate 5–10% and watch bookings.`,
        });
      } else if (occ < 0.4 && myAdr > peerAdr * 1.1) {
        alerts.push({
          id: `over-${u.unit.id}`,
          severity: "medium",
          kind: "overpriced",
          unitId: u.unit.id,
          title: `${name}: price may be keeping guests away`,
          detail: `Only ${pct(occ)} booked in ${monthLabel} at ${money(myAdr)}/night, above the ${money(peerAdr)} ${where} averaged. Consider a lower rate or a last-minute discount.`,
        });
      }
    }

    // Losing money two months running.
    const prev = u.months[shiftMonth(recent, -1)];
    if (s.expenses > 0 && s.profit < 0 && prev && prev.expenses > 0 && prev.profit < 0) {
      alerts.push({
        id: `loss-${u.unit.id}`,
        severity: "high",
        kind: "losing_money",
        unitId: u.unit.id,
        title: `${name}: lost money two months in a row`,
        detail: `Net ${money(prev.profit)} last month and ${money(s.profit)} in ${monthLabel} after expenses.`,
      });
    }

    // No new check-ins in the last 30 days of data.
    if (u.lastNight && u.lastNight < addDays(p.dataEnd, -30)) {
      alerts.push({
        id: `quiet-${u.unit.id}`,
        severity: "high",
        kind: "no_recent_bookings",
        unitId: u.unit.id,
        title: `${name}: no stays in the last 30 days`,
        detail: `The last booked night was ${u.lastNight}. Check the calendar is open and the listing is live.`,
      });
    }

    // Below break-even on average.
    const be = breakEven(u, p.months);
    if (be.cushion != null && be.fixedMonthly > 0 && be.cushion < 0) {
      alerts.push({
        id: `be-${u.unit.id}`,
        severity: "medium",
        kind: "below_break_even",
        unitId: u.unit.id,
        title: `${name}: below break-even`,
        detail: `Needs about ${Math.ceil(be.nightsNeeded!)} nights a month at ${money(be.adr!)} to cover ${money(be.fixedMonthly)} in fixed costs, but averages ${be.avgNights.toFixed(1)}.`,
      });
    }
  }

  const order: Record<AlertSeverity, number> = { high: 0, medium: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * The month the latest upload stops part-way through, if it's in range —
 * its numbers are incomplete, so pages mark it rather than show a "drop".
 */
export function partialMonth(p: Portfolio): string | null {
  if (!p.dataEnd) return null;
  const mo = monthOf(p.dataEnd);
  return p.months.includes(mo) && p.dataEnd < monthEnd(mo) ? mo : null;
}

export function partialNote(p: Portfolio): string | null {
  const mo = partialMonth(p);
  return mo ? `${labelMonth(mo)} only has data up to ${Number(p.dataEnd!.slice(8, 10))} ${labelMonth(mo, false)} so far.` : null;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function labelMonth(month: string, withYear = true): string {
  const [y, m] = month.split("-").map(Number);
  return withYear ? `${MONTH_NAMES[m - 1]} ${y}` : MONTH_NAMES[m - 1];
}
