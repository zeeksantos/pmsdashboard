// Everything the tabbed Portfolio Analytics dashboard shows, computed from
// one workspace's imported transactions, units, listings and expenses.
// Pure and serialisable: built on the server, rendered by the client tabs.
//
// Definitions follow the original single-portfolio dashboard:
// - Money is counted in the month it was earned (Airbnb transaction date;
//   check-in for Booking.com / Agoda reservation rows). Payouts are bank
//   transfers of money already counted and never add to earnings.
// - Gross = guest-paid booking totals + co-host shares received; fees = the
//   channel's service fee / commission; adjustments = everything else
//   (co-host shares paid out, refunds, claims, cancellation fees…), so
//   gross − fees + adjustments = net.
// - Nights and occupancy come from the stay dates themselves, de-duplicated
//   per unit so two listings on one unit never double-count a night.

import { addDays } from "./values.ts";
import {
  buildPortfolio,
  computeAlerts,
  labelMonth,
  monthEnd,
  monthOf,
  monthRange,
  monthStart,
  type Alert,
  type ExpenseInput,
  type FixedCostInput,
  type MonthlyCostInput,
} from "./metrics.ts";

export interface ReportTxn {
  id: string;
  kind: "booking" | "payout" | "adjustment" | "resolution" | "cancellation" | "cohost" | "tax" | "other";
  raw_type: string | null;
  channel: string;
  txn_date: string;
  booked_on: string | null;
  confirmation_code: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  currency: string;
  amount: number;
  fx_rate: number;
  amount_base: number;
  gross: number | null;
  service_fee: number | null;
  cleaning_fee: number | null;
  paid_out: number | null;
  details: string | null;
  listing_id: string | null;
}

export interface ReportUnitInput {
  id: string;
  name: string;
  nickname: string | null;
  building: string | null;
  area: string | null;
  owner_id: string | null;
  active_from: string | null;
  archived: boolean;
}

export interface ReportListingInput {
  id: string;
  channel: string;
  external_name: string;
  unit_id: string | null;
}

export interface ReportInput {
  transactions: ReportTxn[];
  units: ReportUnitInput[];
  listings: ReportListingInput[];
  fixedCosts: FixedCostInput[];
  monthlyCosts: MonthlyCostInput[];
  expenses: ExpenseInput[];
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  today: string; // YYYY-MM-DD (Manila)
  lastImportAt: string | null; // YYYY-MM-DD
  formatMoney: (n: number) => string;
}

// ── palette (validated for CVD separation, see dataviz notes) ────────────
export const INK = "#16232B";
export const NEG = "#C7452B";
export const POS = "#1F8A55";
export const AMBER = "#B8860B";
export const AREA_COLORS = ["#3A4F7C", "#0E8C8E", "#8A5A9E", "#B8860B", "#5B7F3A", "#A3542F"];
export const AREA_RGB = ["58,79,124", "14,140,142", "138,90,158", "184,134,11", "91,127,58", "163,84,47"];
export const NO_AREA = "No area set";

const LTR_RE = /\b(ltr|long[- ]?term|long[- ]?stay|monthly)\b/i;
const ADJUST_KINDS = new Set(["adjustment", "resolution", "cancellation", "tax", "other"]);

// ── helpers ──────────────────────────────────────────────────────────────
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}
function weekday(d: string): number {
  return new Date(d + "T00:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
}
const base = (t: ReportTxn, v: number | null) => (v == null ? 0 : Number(v) * Number(t.fx_rate || 1));
/** Whether a co-host line is income (you co-host) or a share you paid out. */
const isCohostIn = (t: ReportTxn) => t.kind === "cohost" && Number(t.amount_base) > 0;
/** Lines that represent a guest stay for you. */
const isStay = (t: ReportTxn) => t.kind === "booking" || isCohostIn(t);

// ── output types ─────────────────────────────────────────────────────────
export interface AreaInfo {
  name: string;
  color: string;
  rgb: string;
}

export interface UnitReport {
  id: string;
  name: string;
  nickname: string;
  building: string;
  area: string;
  color: string;
  rgb: string;
  archived: boolean;
  ownerId: string | null;
  listings: { id: string; name: string; channel: string; net: number }[];
  net: number;
  gross: number;
  fees: number;
  stays: number;
  nights: number; // de-duplicated occupied nights in the window
  stayNights: number; // nights on stay lines (as booked)
  first: string | null; // first occupied night (all time)
  activeDays: number;
  rate: number; // nights ÷ window days
  rateActive: number; // nights ÷ days since first stay
  perAvail: number; // net ÷ window days (RevPAR)
  adr: number;
  avgStay: number;
  cleanPerStay: number;
  monthNet: number[];
  monthStays: number[];
  monthNights: number[];
  monthAdr: (number | null)[];
  lead: number | null;
  sameDay: number;
  weekend: { booked: number; avail: number };
  weekdayNights: { booked: number; avail: number };
  gap1: number;
  gap2: number;
  orphan: number;
  refund: number; // negative = money returned / clawed back
  refundBase: number; // money earned it's compared to
  refundRate: number;
  ltrShare: number;
  ltrAmt: number;
  guests: number;
  repeatGuests: number;
  revShare: number;
  startMonthIndex: number; // first month index the unit was operating (−1 = before window)
}

export interface ListingReport {
  id: string;
  name: string;
  channel: string;
  unitId: string | null;
  unitLabel: string;
  building: string;
  area: string;
  color: string;
  model: string;
  gross: number;
  adj: number;
  fees: number;
  net: number;
  nights: number;
  bookings: number;
  avgStay: number;
  adr: number;
}

export interface TxnRow {
  id: string;
  date: string;
  type: string;
  kind: ReportTxn["kind"];
  code: string;
  guest: string;
  listing: string;
  listingId: string | null;
  details: string;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  currency: string;
  amount: number;
  amountBase: number;
  paidOut: number | null;
  paidOutBase: number | null;
  fee: number | null;
  cleaning: number | null;
  gross: number | null;
  monthIndex: number;
}

export interface Report {
  months: string[];
  monthLabels: string[];
  window: { start: string; end: string; days: number; monthDays: number[]; partialLast: boolean };
  areas: AreaInfo[];
  overview: {
    net: number;
    gross: number;
    fees: number;
    adjustments: number;
    cohostPaid: number;
    cohostReceived: number;
    nights: number;
    stays: number;
    avgStay: number;
    netPerDay: number;
    monthlyNet: number[];
    monthlyGross: number[];
    streams: { key: string; label: string; color: string; values: number[]; total: number }[];
    activity: { bookings: number[]; nights: number[] };
    payouts: { method: string; currency: string; amount: number; share: number }[];
    byType: { label: string; amount: number }[];
    unlinkedNet: number;
  };
  units: UnitReport[];
  buildings: { name: string; area: string; color: string; total: number; unitIds: string[] }[];
  occupancy: {
    rate: number;
    nights: number;
    unitNights: number;
    byArea: { area: string; color: string; rate: number; units: number }[];
  };
  advanced: {
    leadMedian: number | null;
    sameDayShare: number;
    leadBuckets: { label: string; count: number }[];
    leadByMonth: (number | null)[];
    weekendRate: number;
    weekdayRate: number;
    orphanTotal: number;
    orphanValue: number;
    refundRate: number;
    refundTotal: number;
    repeatGuests: number;
    totalGuests: number;
    repeatStays: number;
    topRepeat: { guest: string; stays: number }[];
    top3Share: number;
    top3: string[];
    payoutLag: number | null;
    adrByArea: { area: string; color: string; values: (number | null)[] }[];
    seasonality: { area: string; color: string; values: (number | null)[] }[];
    adrMax: number;
  };
  listings: ListingReport[];
  cohost: {
    received: number;
    stays: number;
    nights: number;
    listings: ListingReport[];
    shared: { listing: string; collected: number[]; paid: number[]; collectedTotal: number; paidTotal: number; nights: number; adjustments: number }[];
  };
  refunds: {
    rows: { id: string; date: string; category: string; listing: string; details: string; amount: number; currency: string; amountBase: number }[];
    claims: number;
    claimCount: number;
    resolutionIn: number;
    resolutionOut: number;
    resolutionOutCount: number;
    otherAdjustments: number;
    cancellationNet: number;
    cancellationCount: number;
    net: number;
    byListing: { listing: string; amount: number }[];
  };
  transactions: TxnRow[];
  alerts: Alert[];
  unlinkedListings: number;
  hasData: boolean;
}

export function buildReport(input: ReportInput): Report {
  const months = monthRange(input.from, input.to);
  const monthIdx = new Map(months.map((m, i) => [m, i]));
  const zero = () => months.map(() => 0);

  const unitById = new Map(input.units.map((u) => [u.id, u]));
  const listingById = new Map(input.listings.map((l) => [l.id, l]));
  const unitOfTxn = (t: ReportTxn) => {
    const l = t.listing_id ? listingById.get(t.listing_id) : undefined;
    return l?.unit_id ? unitById.get(l.unit_id) ?? null : null;
  };
  const revenueDate = (t: ReportTxn) => (t.channel === "airbnb" ? t.txn_date : t.check_in ?? t.txn_date);

  // ── window: from the period start (or first data) to the latest data ──
  const periodStart = monthStart(months[0]);
  const periodEnd = monthEnd(months[months.length - 1]);
  const inPeriod = (d: string) => d >= periodStart && d <= periodEnd;
  const txns = input.transactions.filter((t) => inPeriod(revenueDate(t)));
  const allDates = txns.map((t) => t.txn_date).sort();
  const dataEnd = allDates.length ? allDates[allDates.length - 1] : null;
  const firstData = allDates.length ? allDates[0] : null;
  const start = firstData && monthStart(monthOf(firstData)) > periodStart ? monthStart(monthOf(firstData)) : periodStart;
  const end = dataEnd && dataEnd < periodEnd ? dataEnd : periodEnd;
  const windowDays = Math.max(1, daysBetween(start, end) + 1);
  const monthDays = months.map((m) => {
    const a = monthStart(m) > start ? monthStart(m) : start;
    const b = monthEnd(m) < end ? monthEnd(m) : end;
    return b >= a ? daysBetween(a, b) + 1 : 0;
  });
  const lastIdx = months.length - 1;
  const partialLast = monthDays[lastIdx] > 0 && monthDays[lastIdx] < Number(monthEnd(months[lastIdx]).slice(8, 10));
  const mi = (d: string) => monthIdx.get(monthOf(d)) ?? -1;

  // ── areas ─────────────────────────────────────────────────────────────
  const areaNet = new Map<string, number>();
  for (const t of txns) {
    if (t.kind === "payout") continue;
    const u = unitOfTxn(t);
    if (!u) continue;
    const a = u.area?.trim() || NO_AREA;
    areaNet.set(a, (areaNet.get(a) ?? 0) + Number(t.amount_base));
  }
  for (const u of input.units) {
    const a = u.area?.trim() || NO_AREA;
    if (!areaNet.has(a)) areaNet.set(a, 0);
  }
  const areaNames = [...areaNet.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const areas: AreaInfo[] = areaNames.map((name, i) => ({
    name,
    color: name === NO_AREA ? "#7F8C93" : AREA_COLORS[i % AREA_COLORS.length],
    rgb: name === NO_AREA ? "127,140,147" : AREA_RGB[i % AREA_RGB.length],
  }));
  const areaInfo = new Map(areas.map((a) => [a.name, a]));
  const areaOf = (u: ReportUnitInput | null) => (u ? u.area?.trim() || NO_AREA : NO_AREA);

  // ── overview ──────────────────────────────────────────────────────────
  let net = 0;
  let gross = 0;
  let fees = 0;
  let cohostPaid = 0;
  let cohostReceived = 0;
  let unlinkedNet = 0;
  const monthlyNet = zero();
  const monthlyGross = zero();
  const bookingsByMonth = zero();
  const nightsByMonth = zero();
  const streamMap = new Map<string, { key: string; label: string; color: string; values: number[] }>();
  const stream = (key: string, label: string, color: string) => {
    let s = streamMap.get(key);
    if (!s) streamMap.set(key, (s = { key, label, color, values: zero() }));
    return s;
  };
  const typeTotals = new Map<string, number>();
  const addType = (label: string, v: number) => typeTotals.set(label, (typeTotals.get(label) ?? 0) + v);
  const payoutMap = new Map<string, { method: string; currency: string; amount: number }>();
  let stays = 0;
  let stayNightsTotal = 0;

  for (const t of txns) {
    const i = mi(revenueDate(t));
    if (t.kind === "payout") {
      const method = (t.details ?? "Payout").split(":")[0].trim() || "Payout";
      const key = `${method}|${t.currency}`;
      const p = payoutMap.get(key) ?? { method, currency: t.currency, amount: 0 };
      p.amount += Number(t.paid_out ?? 0);
      payoutMap.set(key, p);
      continue;
    }
    const amt = Number(t.amount_base);
    net += amt;
    if (i >= 0) monthlyNet[i] += amt;
    const u = unitOfTxn(t);
    if (!u) unlinkedNet += amt;
    let g = 0;
    if (t.kind === "booking") {
      g = t.gross != null ? base(t, t.gross) : amt + base(t, t.service_fee);
      fees += base(t, t.service_fee);
      addType("Bookings", amt);
    } else if (isCohostIn(t)) {
      g = amt;
      cohostReceived += amt;
      addType("Co-host shares received", amt);
    } else if (t.kind === "cohost") {
      cohostPaid += amt;
      addType("Co-host shares paid out", amt);
    } else if (t.kind === "resolution") addType("Resolutions & claims", amt);
    else if (t.kind === "cancellation") addType("Cancellation fees", amt);
    else if (t.kind === "tax") addType("Taxes", amt);
    else addType("Adjustments & other", amt);
    gross += g;
    if (i >= 0) monthlyGross[i] += g;

    if (isStay(t)) {
      stays += 1;
      stayNightsTotal += Number(t.nights ?? 0);
      if (i >= 0) {
        bookingsByMonth[i] += 1;
        nightsByMonth[i] += Number(t.nights ?? 0);
      }
    }

    // where the money comes from
    if (i < 0) continue;
    if (isCohostIn(t)) stream("cohost", "Co-host shares received", "#7FB3B4").values[i] += amt;
    else if (ADJUST_KINDS.has(t.kind)) stream("other", "Refunds, claims, adjustments", NEG).values[i] += amt;
    else if (!u) stream("unlinked", "Listings not linked to a unit", "#9AA6AC").values[i] += amt;
    else {
      const a = areaOf(u);
      const info = areaInfo.get(a)!;
      stream(`area:${a}`, a === NO_AREA ? "Units without an area" : `${a} (you host)`, info.color).values[i] += amt;
    }
  }
  const streamOrder = (k: string) => (k.startsWith("area:") ? areaNames.indexOf(k.slice(5)) : k === "cohost" ? 100 : k === "unlinked" ? 101 : 102);
  const streams = [...streamMap.values()]
    .filter((s) => s.values.some((v) => Math.abs(v) >= 1))
    .sort((a, b) => streamOrder(a.key) - streamOrder(b.key))
    .map((s) => ({ ...s, total: sum(s.values) }));
  const payoutTotalByCur = new Map<string, number>();
  for (const p of payoutMap.values()) payoutTotalByCur.set(p.currency, (payoutTotalByCur.get(p.currency) ?? 0) + p.amount);
  const payouts = [...payoutMap.values()]
    .filter((p) => p.amount)
    .sort((a, b) => b.amount - a.amount)
    .map((p) => ({ ...p, share: p.amount / (payoutTotalByCur.get(p.currency) || 1) }));
  const typeOrder = ["Bookings", "Co-host shares received", "Co-host shares paid out", "Resolutions & claims", "Cancellation fees", "Adjustments & other", "Taxes"];
  const byType = typeOrder.filter((l) => typeTotals.has(l) && Math.abs(typeTotals.get(l)!) >= 1).map((label) => ({ label, amount: typeTotals.get(label)! }));

  // ── per unit ──────────────────────────────────────────────────────────
  const nightSets = new Map<string, Set<string>>(); // window nights
  const firstNightAll = new Map<string, string>();
  const unitAgg = new Map<
    string,
    {
      net: number;
      gross: number;
      fees: number;
      stays: number;
      stayNights: number;
      clean: number;
      adrNum: number;
      adrDen: number;
      cohostIn: number;
      cohostNights: number;
      monthNet: number[];
      monthStays: number[];
      monthAdrNum: number[];
      monthAdrDen: number[];
      leads: number[];
      refund: number;
      earned: number;
      ltrNights: number;
      ltrAmt: number;
      guests: Map<string, number>;
    }
  >();
  const agg = (id: string) => {
    let a = unitAgg.get(id);
    if (!a) {
      unitAgg.set(
        id,
        (a = {
          net: 0,
          gross: 0,
          fees: 0,
          stays: 0,
          stayNights: 0,
          clean: 0,
          adrNum: 0,
          adrDen: 0,
          cohostIn: 0,
          cohostNights: 0,
          monthNet: zero(),
          monthStays: zero(),
          monthAdrNum: zero(),
          monthAdrDen: zero(),
          leads: [],
          refund: 0,
          earned: 0,
          ltrNights: 0,
          ltrAmt: 0,
          guests: new Map(),
        })
      );
    }
    return a;
  };

  // All-time first nights (for "operating since") use every loaded row.
  for (const t of input.transactions) {
    const u = unitOfTxn(t);
    if (!u || !isStay(t) || !t.check_in) continue;
    const f = firstNightAll.get(u.id);
    if (!f || t.check_in < f) firstNightAll.set(u.id, t.check_in);
  }

  const leadsAll: number[] = [];
  const leadsByBookMonth = months.map(() => [] as number[]);
  const lags: number[] = [];
  const guestStays = new Map<string, number>();
  const seenStay = new Set<string>();

  for (const t of input.transactions) {
    // occupancy uses stay dates, so include stays that touch the window
    const u = unitOfTxn(t);
    if (!u || !isStay(t) || !t.check_in || !t.check_out || t.check_out <= t.check_in) continue;
    let set = nightSets.get(u.id);
    if (!set) nightSets.set(u.id, (set = new Set()));
    for (let d = t.check_in; d < t.check_out; d = addDays(d, 1)) if (d >= start && d <= end) set.add(d);
  }

  for (const t of txns) {
    if (t.kind === "payout") continue;
    const u = unitOfTxn(t);
    const amt = Number(t.amount_base);
    const i = mi(revenueDate(t));
    if (t.kind === "booking" && t.channel === "airbnb" && t.check_in) lags.push(daysBetween(t.check_in, t.txn_date));
    if (isStay(t) && t.booked_on && t.check_in) {
      const lead = Math.max(0, daysBetween(t.booked_on, t.check_in));
      leadsAll.push(lead);
      const bi = mi(t.booked_on);
      if (bi >= 0) leadsByBookMonth[bi].push(lead);
      if (u) agg(u.id).leads.push(lead);
    }
    if (isStay(t) && t.guest_name) {
      const key = `${(t.guest_name ?? "").trim().toLowerCase()}|${t.confirmation_code ?? t.id}`;
      if (!seenStay.has(key)) {
        seenStay.add(key);
        const g = t.guest_name.trim();
        guestStays.set(g, (guestStays.get(g) ?? 0) + 1);
        if (u) agg(u.id).guests.set(g, (agg(u.id).guests.get(g) ?? 0) + 1);
      }
    }
    if (!u) continue;
    const a = agg(u.id);
    a.net += amt;
    if (i >= 0) a.monthNet[i] += amt;
    const listingName = t.listing_id ? listingById.get(t.listing_id)?.external_name ?? "" : "";
    if (t.kind === "booking") {
      const g = t.gross != null ? base(t, t.gross) : amt + base(t, t.service_fee);
      const clean = base(t, t.cleaning_fee);
      a.gross += g;
      a.fees += base(t, t.service_fee);
      a.clean += clean;
      a.earned += amt;
      const n = Number(t.nights ?? 0);
      if (n > 0) {
        a.adrNum += g - clean;
        a.adrDen += n;
        const ci = t.check_in ? mi(t.check_in) : -1;
        if (ci >= 0) {
          a.monthAdrNum[ci] += g - clean;
          a.monthAdrDen[ci] += n;
        }
      }
    } else if (isCohostIn(t)) {
      a.gross += amt;
      a.earned += amt;
      a.cohostIn += amt;
      a.cohostNights += Number(t.nights ?? 0);
    } else if (ADJUST_KINDS.has(t.kind) && amt < 0) {
      a.refund += amt;
    }
    if (isStay(t)) {
      a.stays += 1;
      a.stayNights += Number(t.nights ?? 0);
      if (i >= 0) a.monthStays[i] += 1;
      if (LTR_RE.test(listingName)) {
        a.ltrNights += Number(t.nights ?? 0);
        a.ltrAmt += amt;
      }
    }
  }

  const totalUnitNet = sum([...unitAgg.values()].map((a) => a.net));
  const units: UnitReport[] = input.units.map((u) => {
    const a = agg(u.id);
    const area = areaOf(u);
    const info = areaInfo.get(area)!;
    const nights = nightSets.get(u.id) ?? new Set<string>();
    const first = u.active_from ?? firstNightAll.get(u.id) ?? null;
    const activeStart = first && first > start ? first : start;
    const activeDays = first ? Math.max(0, daysBetween(activeStart, end) + 1) : 0;
    const monthNights = zero();
    for (const d of nights) {
      const i = mi(d);
      if (i >= 0) monthNights[i] += 1;
    }
    // weekend (Fri, Sat nights) vs weekday occupancy, and short empty gaps
    const weekend = { booked: 0, avail: 0 };
    const weekdayNights = { booked: 0, avail: 0 };
    let gap1 = 0;
    let gap2 = 0;
    if (first && activeDays > 0) {
      let run = 0;
      let seenBooked = false;
      for (let d = activeStart; d <= end; d = addDays(d, 1)) {
        const wd = weekday(d);
        const booked = nights.has(d);
        const bucket = wd === 5 || wd === 6 ? weekend : weekdayNights;
        bucket.avail += 1;
        if (booked) bucket.booked += 1;
        if (booked) {
          if (seenBooked && run === 1) gap1++;
          if (seenBooked && run === 2) gap2++;
          run = 0;
          seenBooked = true;
        } else run++;
      }
    }
    const adrDen = a.adrDen + a.cohostNights;
    const adr = adrDen ? (a.adrNum + a.cohostIn) / adrDen : 0;
    const repeatGuests = [...a.guests.values()].filter((n) => n > 1).length;
    const startIdx = first ? (first < start ? 0 : mi(first)) : -1;
    return {
      id: u.id,
      name: u.name,
      nickname: u.nickname?.trim() || "",
      building: u.building?.trim() || "",
      area,
      color: info.color,
      rgb: info.rgb,
      archived: u.archived,
      ownerId: u.owner_id,
      listings: input.listings
        .filter((l) => l.unit_id === u.id)
        .map((l) => ({ id: l.id, name: l.external_name, channel: l.channel, net: 0 })),
      net: a.net,
      gross: a.gross,
      fees: a.fees,
      stays: a.stays,
      nights: nights.size,
      stayNights: a.stayNights,
      first,
      activeDays,
      rate: nights.size / windowDays,
      rateActive: activeDays ? nights.size / activeDays : 0,
      perAvail: a.net / windowDays,
      adr,
      avgStay: a.stays ? a.stayNights / a.stays : 0,
      cleanPerStay: a.stays ? a.clean / a.stays : 0,
      monthNet: a.monthNet,
      monthStays: a.monthStays,
      monthNights,
      monthAdr: months.map((_, i) => {
        const den = a.monthAdrDen[i];
        return den ? a.monthAdrNum[i] / den : null;
      }),
      lead: median(a.leads),
      sameDay: a.leads.length ? a.leads.filter((x) => x === 0).length / a.leads.length : 0,
      weekend,
      weekdayNights,
      gap1,
      gap2,
      orphan: gap1 + 2 * gap2,
      refund: a.refund,
      refundBase: a.earned,
      refundRate: a.earned > 0 ? -a.refund / a.earned : 0,
      ltrShare: a.stayNights ? a.ltrNights / a.stayNights : 0,
      ltrAmt: a.ltrAmt,
      guests: a.guests.size,
      repeatGuests,
      revShare: totalUnitNet ? a.net / totalUnitNet : 0,
      startMonthIndex: startIdx,
    };
  });

  // ── listings ──────────────────────────────────────────────────────────
  const lAgg = new Map<string, { gross: number; fees: number; net: number; nights: number; bookings: number; adrNum: number; adrDen: number; cohostIn: number; cohostOut: number }>();
  const lget = (id: string) => {
    let o = lAgg.get(id);
    if (!o) lAgg.set(id, (o = { gross: 0, fees: 0, net: 0, nights: 0, bookings: 0, adrNum: 0, adrDen: 0, cohostIn: 0, cohostOut: 0 }));
    return o;
  };
  for (const t of txns) {
    if (t.kind === "payout" || !t.listing_id) continue;
    const o = lget(t.listing_id);
    const amt = Number(t.amount_base);
    o.net += amt;
    if (t.kind === "booking") {
      const g = t.gross != null ? base(t, t.gross) : amt + base(t, t.service_fee);
      o.gross += g;
      o.fees += base(t, t.service_fee);
      const n = Number(t.nights ?? 0);
      if (n) {
        o.adrNum += g - base(t, t.cleaning_fee);
        o.adrDen += n;
      }
    } else if (isCohostIn(t)) {
      o.gross += amt;
      o.cohostIn += amt;
      o.adrNum += amt;
      o.adrDen += Number(t.nights ?? 0);
    } else if (t.kind === "cohost") o.cohostOut += amt;
    if (isStay(t)) {
      o.bookings += 1;
      o.nights += Number(t.nights ?? 0);
    }
  }
  const unitReportById = new Map(units.map((u) => [u.id, u]));
  const listings: ListingReport[] = input.listings.map((l) => {
    const o = lget(l.id);
    const u = l.unit_id ? unitReportById.get(l.unit_id) : undefined;
    if (u) {
      const entry = u.listings.find((x) => x.id === l.id);
      if (entry) entry.net = o.net;
    }
    let model = "No activity";
    if (o.cohostIn > 0 && o.gross === o.cohostIn) model = "Co-host";
    else if (o.cohostOut < 0) model = "Primary host, shared";
    else if (o.bookings > 0 || o.gross > 0) model = "Primary host";
    return {
      id: l.id,
      name: l.external_name,
      channel: l.channel,
      unitId: l.unit_id,
      unitLabel: u ? u.name : "",
      building: u?.building ?? "",
      area: u?.area ?? "",
      color: u?.color ?? "#9AA6AC",
      model,
      gross: o.gross,
      adj: o.net - o.gross + o.fees,
      fees: -o.fees,
      net: o.net,
      nights: o.nights,
      bookings: o.bookings,
      avgStay: o.bookings ? o.nights / o.bookings : 0,
      adr: o.adrDen ? o.adrNum / o.adrDen : 0,
    };
  });

  // ── buildings ─────────────────────────────────────────────────────────
  const bMap = new Map<string, { name: string; area: string; color: string; total: number; unitIds: string[] }>();
  for (const u of units) {
    const name = u.building || "Other units";
    const b = bMap.get(name) ?? { name, area: u.area, color: u.color, total: 0, unitIds: [] };
    b.total += u.net;
    b.unitIds.push(u.id);
    bMap.set(name, b);
  }
  const buildings = [...bMap.values()]
    .map((b) => ({ ...b, unitIds: b.unitIds.sort((x, y) => unitReportById.get(y)!.net - unitReportById.get(x)!.net) }))
    .sort((a, b) => areaNames.indexOf(a.area) - areaNames.indexOf(b.area) || b.total - a.total);

  // ── occupancy ─────────────────────────────────────────────────────────
  const live = units.filter((u) => !u.archived && u.first);
  const occNights = sum(live.map((u) => u.nights));
  const unitNights = live.length * windowDays;
  const byArea = areas
    .map((a) => {
      const us = live.filter((u) => u.area === a.name);
      return { area: a.name, color: a.color, units: us.length, rate: us.length ? sum(us.map((u) => u.nights)) / (us.length * windowDays) : 0 };
    })
    .filter((a) => a.units > 0);

  // ── advanced ──────────────────────────────────────────────────────────
  const bucketDefs: [string, (d: number) => boolean][] = [
    ["Same day", (d) => d === 0],
    ["1–3 days", (d) => d >= 1 && d <= 3],
    ["4–7 days", (d) => d >= 4 && d <= 7],
    ["8–14 days", (d) => d >= 8 && d <= 14],
    ["15–30 days", (d) => d >= 15 && d <= 30],
    ["31+ days", (d) => d > 30],
  ];
  const weekendTot = sum(live.map((u) => u.weekend.booked));
  const weekendAvail = sum(live.map((u) => u.weekend.avail));
  const weekdayTot = sum(live.map((u) => u.weekdayNights.booked));
  const weekdayAvail = sum(live.map((u) => u.weekdayNights.avail));
  const orphanTotal = sum(live.map((u) => u.orphan));
  const adrNights = sum(live.map((u) => u.stayNights));
  const avgAdr = adrNights ? sum(live.map((u) => u.adr * u.stayNights)) / adrNights : 0;
  const refundTotal = sum(units.map((u) => u.refund));
  const earnedTotal = sum(units.map((u) => u.refundBase));
  const repeaters = [...guestStays.entries()].filter(([, n]) => n > 1);
  const byRev = [...units].filter((u) => !u.archived).sort((a, b) => b.net - a.net);
  const top3 = byRev.slice(0, 3);

  const adrByArea = areas
    .map((a) => {
      const values = months.map((_, i) => {
        let num = 0;
        let den = 0;
        for (const t of txns) {
          if (t.kind !== "booking" || !t.check_in || mi(t.check_in) !== i) continue;
          const u = unitOfTxn(t);
          if (!u || areaOf(u) !== a.name) continue;
          const n = Number(t.nights ?? 0);
          if (!n) continue;
          const g = t.gross != null ? base(t, t.gross) : Number(t.amount_base) + base(t, t.service_fee);
          num += g - base(t, t.cleaning_fee);
          den += n;
        }
        return den ? num / den : null;
      });
      return { area: a.name, color: a.color, values };
    })
    .filter((a) => a.values.some((v) => v != null));

  const fullMonths = months.map((_, i) => monthDays[i] > 0 && !(partialLast && i === lastIdx));
  const seasonality = areas
    .map((a) => {
      const us = units.filter((u) => u.area === a.name);
      const per = months.map((_, i) => sum(us.map((u) => u.monthNet[i])));
      const valid = per.filter((_, i) => fullMonths[i]);
      const avg = valid.length ? sum(valid) / valid.length : 0;
      return { area: a.name, color: a.color, values: per.map((v, i) => (fullMonths[i] && avg ? v / avg : null)) };
    })
    .filter((s) => s.values.some((v) => v != null && v !== 0));
  const adrMax = Math.max(0, ...units.flatMap((u) => u.monthAdr.filter((x): x is number => x != null)));

  // ── co-host ───────────────────────────────────────────────────────────
  const cohostListings = listings.filter((l) => l.model === "Co-host");
  const sharedIds = new Set(listings.filter((l) => l.model === "Primary host, shared").map((l) => l.id));
  const shared = [...sharedIds].map((id) => {
    const l = listingById.get(id)!;
    const collected = zero();
    const paid = zero();
    let adjustments = 0;
    for (const t of txns) {
      if (t.listing_id !== id) continue;
      const i = mi(revenueDate(t));
      if (t.kind === "booking" && i >= 0) collected[i] += Number(t.amount_base);
      else if (t.kind === "cohost" && i >= 0) paid[i] += Number(t.amount_base);
      else if (ADJUST_KINDS.has(t.kind)) adjustments += Number(t.amount_base);
    }
    return {
      listing: l.external_name,
      collected,
      paid,
      collectedTotal: sum(collected),
      paidTotal: sum(paid),
      nights: lget(id).nights,
      adjustments,
    };
  });

  // ── refunds & claims ──────────────────────────────────────────────────
  const category = (t: ReportTxn) => {
    if (t.kind === "resolution" && /aircover/i.test(t.details ?? "")) return "AirCover claim";
    return t.raw_type || t.kind;
  };
  const refundRows = txns
    .filter((t) => ADJUST_KINDS.has(t.kind))
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date))
    .map((t) => ({
      id: t.id,
      date: t.txn_date,
      category: category(t),
      listing: t.listing_id ? listingById.get(t.listing_id)?.external_name ?? "" : "",
      details: t.details ?? "",
      amount: Number(t.amount),
      currency: t.currency,
      amountBase: Number(t.amount_base),
    }));
  const rsum = (f: (r: (typeof refundRows)[number]) => boolean) => sum(refundRows.filter(f).map((r) => r.amountBase));
  const claims = rsum((r) => r.category === "AirCover claim");
  const resolutionIn = rsum((r) => r.category !== "AirCover claim" && /resolution/i.test(r.category) && r.amountBase > 0);
  const resolutionOut = rsum((r) => /resolution/i.test(r.category) && r.amountBase < 0);
  const cancellationNet = rsum((r) => /cancel/i.test(r.category));
  const otherAdjustments = sum(refundRows.map((r) => r.amountBase)) - claims - resolutionIn - resolutionOut - cancellationNet;
  const adjBy = new Map<string, number>();
  for (const r of refundRows) {
    const k = r.listing || "Not tied to a listing";
    adjBy.set(k, (adjBy.get(k) ?? 0) + r.amountBase);
  }

  // ── transactions ──────────────────────────────────────────────────────
  const transactions: TxnRow[] = txns
    .slice()
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date) || a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      date: t.txn_date,
      type: t.raw_type || t.kind,
      kind: t.kind,
      code: t.confirmation_code ?? "",
      guest: t.guest_name ?? "",
      listing: t.listing_id ? listingById.get(t.listing_id)?.external_name ?? "" : "",
      listingId: t.listing_id,
      details: t.details ?? "",
      checkIn: t.check_in,
      checkOut: t.check_out,
      nights: t.nights,
      currency: t.currency,
      amount: Number(t.amount),
      amountBase: Number(t.amount_base),
      paidOut: t.paid_out == null ? null : Number(t.paid_out),
      paidOutBase: t.paid_out == null ? null : base(t, t.paid_out),
      fee: t.service_fee == null ? null : Number(t.service_fee),
      cleaning: t.cleaning_fee == null ? null : Number(t.cleaning_fee),
      gross: t.gross == null ? null : Number(t.gross),
      monthIndex: mi(revenueDate(t)),
    }));

  // ── alerts (shared rules with the rest of the module) ─────────────────
  const portfolio = buildPortfolio(
    {
      transactions: input.transactions.map((t) => ({
        id: t.id,
        kind: t.kind,
        channel: t.channel,
        txn_date: t.txn_date,
        check_in: t.check_in,
        check_out: t.check_out,
        amount_base: Number(t.amount_base),
        listing_id: t.listing_id,
        confirmation_code: t.confirmation_code,
      })),
      units: input.units,
      listings: input.listings,
      fixedCosts: input.fixedCosts,
      monthlyCosts: input.monthlyCosts,
      expenses: input.expenses,
    },
    { from: input.from, to: input.to }
  );
  const unlinkedListings = input.listings.filter((l) => !l.unit_id).length;
  const alerts = computeAlerts(portfolio, {
    today: input.today,
    lastImportAt: input.lastImportAt,
    unmappedListings: unlinkedListings,
    formatMoney: input.formatMoney,
  });

  return {
    months,
    monthLabels: months.map((m) => labelMonth(m, false)),
    window: { start, end, days: windowDays, monthDays, partialLast },
    areas,
    overview: {
      net,
      gross,
      fees: -fees,
      adjustments: net - gross + fees,
      cohostPaid,
      cohostReceived,
      nights: stayNightsTotal,
      stays,
      avgStay: stays ? stayNightsTotal / stays : 0,
      netPerDay: net / windowDays,
      monthlyNet,
      monthlyGross,
      streams,
      activity: { bookings: bookingsByMonth, nights: nightsByMonth },
      payouts,
      byType,
      unlinkedNet,
    },
    units,
    buildings,
    occupancy: { rate: unitNights ? occNights / unitNights : 0, nights: occNights, unitNights, byArea },
    advanced: {
      leadMedian: median(leadsAll),
      sameDayShare: leadsAll.length ? leadsAll.filter((d) => d === 0).length / leadsAll.length : 0,
      leadBuckets: bucketDefs.map(([label, f]) => ({ label, count: leadsAll.filter(f).length })),
      leadByMonth: leadsByBookMonth.map((xs) => median(xs)),
      weekendRate: weekendAvail ? weekendTot / weekendAvail : 0,
      weekdayRate: weekdayAvail ? weekdayTot / weekdayAvail : 0,
      orphanTotal,
      orphanValue: orphanTotal * avgAdr,
      refundRate: earnedTotal > 0 ? -refundTotal / earnedTotal : 0,
      refundTotal,
      repeatGuests: repeaters.length,
      totalGuests: guestStays.size,
      repeatStays: sum(repeaters.map(([, n]) => n - 1)),
      topRepeat: repeaters
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12)
        .map(([guest, n]) => ({ guest, stays: n })),
      top3Share: totalUnitNet ? sum(top3.map((u) => u.net)) / totalUnitNet : 0,
      top3: top3.map((u) => u.name),
      payoutLag: median(lags),
      adrByArea,
      seasonality,
      adrMax,
    },
    listings,
    cohost: {
      received: cohostReceived,
      stays: sum(cohostListings.map((l) => l.bookings)),
      nights: sum(cohostListings.map((l) => l.nights)),
      listings: cohostListings,
      shared,
    },
    refunds: {
      rows: refundRows,
      claims,
      claimCount: refundRows.filter((r) => r.category === "AirCover claim").length,
      resolutionIn,
      resolutionOut,
      resolutionOutCount: refundRows.filter((r) => /resolution/i.test(r.category) && r.amountBase < 0).length,
      otherAdjustments,
      cancellationNet,
      cancellationCount: refundRows.filter((r) => /cancel/i.test(r.category)).length,
      net: sum(refundRows.map((r) => r.amountBase)),
      byListing: [...adjBy.entries()].sort((a, b) => a[1] - b[1]).map(([listing, amount]) => ({ listing, amount })),
    },
    transactions,
    alerts,
    unlinkedListings,
    hasData: txns.length > 0,
  };
}
