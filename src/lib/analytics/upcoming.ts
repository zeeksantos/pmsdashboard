// Upcoming bookings ("on the books"): reservations from Airbnb's pending
// export that haven't paid out yet. They never count as earnings — this
// builds the forward-looking view from the same an_transactions rows
// (pending = true) the import stored.

import { daysInMonth, labelMonth, monthOf, monthRange } from "./metrics.ts";
import { AREA_COLORS, AREA_RGB, NO_AREA } from "./report.ts";

export interface UpcomingTxn {
  id: string;
  kind: string;
  txn_date: string;
  confirmation_code: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  booked_on: string | null;
  amount_base: number;
  gross: number | null;
  cleaning_fee: number | null;
  fx_rate: number;
  listing_id: string | null;
}

export interface UpcomingUnitInput {
  id: string;
  name: string;
  nickname: string | null;
  building: string | null;
  area: string | null;
  archived: boolean;
}

export interface UpcomingListingInput {
  id: string;
  external_name: string;
  unit_id: string | null;
}

export type StayStatus = "staying" | "upcoming" | "awaiting";

export interface UpcomingStay {
  id: string;
  code: string;
  guest: string;
  group: string;
  listing: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  bookedOn: string | null;
  lead: number | null;
  net: number;
  gross: number | null;
  perNight: number;
  payoutDate: string;
  status: StayStatus;
}

export interface UpcomingGroup {
  key: string;
  unitId: string | null;
  name: string;
  sub: string;
  color: string;
  rgb: string;
  net: number;
  nights: number;
  bookings: number;
  monthNights: number[];
  next30: number;
  next90: number;
}

export interface Upcoming {
  today: string;
  months: string[];
  monthLabels: string[];
  /** Days from today to the end of each month (0 for months already over). */
  monthAvail: number[];
  count: number;
  net: number;
  gross: number;
  nights: number;
  avgStay: number;
  adr: number;
  leadMedian: number | null;
  stayingNow: number;
  furthest: string | null;
  next30: { nights: number; avail: number; rate: number };
  next90: { nights: number; avail: number; rate: number };
  monthly: { net: number[]; nights: number[]; bookings: number[] };
  groups: UpcomingGroup[];
  stays: UpcomingStay[];
  unlinked: number;
}

const DAY = 86_400_000;
const toDay = (d: string) => Date.parse(d + "T00:00:00Z");
const fromDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fromDay(toDay(d) + n * DAY);
const between = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / DAY);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Longest forward view shown, in months. */
export const MAX_MONTHS = 24;

export function buildUpcoming(input: {
  transactions: UpcomingTxn[];
  units: UpcomingUnitInput[];
  listings: UpcomingListingInput[];
  today: string; // YYYY-MM-DD (Manila)
}): Upcoming {
  const { today } = input;
  const thisMonth = monthOf(today);
  const unitById = new Map(input.units.map((u) => [u.id, u]));
  const listingById = new Map(input.listings.map((l) => [l.id, l]));

  const areaNames = [...new Set(input.units.filter((u) => !u.archived).map((u) => u.area?.trim() || NO_AREA))].sort((a, b) =>
    a === NO_AREA ? 1 : b === NO_AREA ? -1 : a.localeCompare(b)
  );
  const areaIdx = new Map(areaNames.map((a, i) => [a, i]));

  const stays = input.transactions.filter(
    (t) => (t.kind === "booking" || (t.kind === "cohost" && Number(t.amount_base) > 0)) && t.check_in && t.check_out && t.check_out > t.check_in
  );

  const lastNight = stays.reduce<string | null>((acc, t) => {
    const ln = addDays(t.check_out!, -1);
    return !acc || ln > acc ? ln : acc;
  }, null);
  const firstNight = stays.reduce<string | null>((acc, t) => (!acc || t.check_in! < acc ? t.check_in! : acc), null);
  const startMonth = firstNight && monthOf(firstNight) < thisMonth ? monthOf(firstNight) : thisMonth;
  let endMonth = lastNight && monthOf(lastNight) > thisMonth ? monthOf(lastNight) : thisMonth;
  const all = monthRange(startMonth, endMonth);
  const months = all.slice(0, MAX_MONTHS);
  endMonth = months[months.length - 1];
  const mIdx = new Map(months.map((m, i) => [m, i]));
  const zero = () => months.map(() => 0);
  const monthAvail = months.map((m) => {
    if (m < thisMonth) return 0;
    if (m === thisMonth) return daysInMonth(m) - Number(today.slice(8, 10)) + 1;
    return daysInMonth(m);
  });

  // Group by unit when the listing is linked, otherwise by listing.
  const groups = new Map<string, UpcomingGroup>();
  const groupFor = (listingId: string | null): UpcomingGroup => {
    const l = listingId ? listingById.get(listingId) : undefined;
    const u = l?.unit_id ? unitById.get(l.unit_id) : undefined;
    const key = u ? `u:${u.id}` : l ? `l:${l.id}` : "none";
    let g = groups.get(key);
    if (!g) {
      const i = u ? areaIdx.get(u.area?.trim() || NO_AREA) ?? 0 : -1;
      g = {
        key,
        unitId: u?.id ?? null,
        name: u ? u.name : l ? l.external_name : "No listing",
        sub: u ? u.nickname || [u.building, u.area].filter(Boolean).join(" · ") : "Not linked to a unit yet",
        color: i >= 0 ? AREA_COLORS[i % AREA_COLORS.length] : "#7A8890",
        rgb: i >= 0 ? AREA_RGB[i % AREA_RGB.length] : "122,136,144",
        net: 0,
        nights: 0,
        bookings: 0,
        monthNights: zero(),
        next30: 0,
        next90: 0,
      };
      groups.set(key, g);
    }
    return g;
  };

  const monthly = { net: zero(), nights: zero(), bookings: zero() };
  const d30 = addDays(today, 30);
  const d90 = addDays(today, 90);
  const leads: number[] = [];
  let net = 0;
  let gross = 0;
  let nights = 0;
  let adrNum = 0;
  let adrDen = 0;
  let stayingNow = 0;
  const rows: UpcomingStay[] = [];

  for (const t of stays) {
    const g = groupFor(t.listing_id);
    const ci = t.check_in!;
    const co = t.check_out!;
    const n = between(ci, co);
    const amt = Number(t.amount_base);
    const fx = Number(t.fx_rate || 1);
    const gr = t.gross == null ? null : Number(t.gross) * fx;
    const clean = t.cleaning_fee == null ? 0 : Number(t.cleaning_fee) * fx;
    net += amt;
    nights += n;
    g.net += amt;
    g.nights += n;
    g.bookings += 1;
    if (gr != null) {
      gross += gr;
      adrNum += gr - clean;
      adrDen += n;
    }
    const bi = mIdx.get(monthOf(ci));
    if (bi != null) monthly.bookings[bi] += 1;
    const perNight = n ? amt / n : 0;
    for (let k = 0; k < n; k++) {
      const night = addDays(ci, k);
      const i = mIdx.get(monthOf(night));
      if (i == null) continue;
      monthly.net[i] += perNight;
      monthly.nights[i] += 1;
      if (night >= today) g.monthNights[i] += 1;
      if (night >= today && night < d30) g.next30 += 1;
      if (night >= today && night < d90) g.next90 += 1;
    }
    if (t.booked_on && t.booked_on <= ci) leads.push(between(t.booked_on, ci));
    const status: StayStatus = co <= today ? "awaiting" : ci <= today ? "staying" : "upcoming";
    if (status === "staying") stayingNow += 1;
    const l = t.listing_id ? listingById.get(t.listing_id) : undefined;
    rows.push({
      id: t.id,
      code: t.confirmation_code ?? "",
      guest: t.guest_name ?? "",
      group: g.name,
      listing: l?.external_name ?? "",
      checkIn: ci,
      checkOut: co,
      nights: n,
      bookedOn: t.booked_on,
      lead: t.booked_on && t.booked_on <= ci ? between(t.booked_on, ci) : null,
      net: amt,
      gross: gr,
      perNight: gr != null && n ? (gr - clean) / n : perNight,
      payoutDate: t.txn_date,
      status,
    });
  }
  rows.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.group.localeCompare(b.group));

  const groupList = [...groups.values()].sort(
    (a, b) => Number(!a.unitId) - Number(!b.unitId) || b.next90 - a.next90 || a.name.localeCompare(b.name)
  );
  // Forward occupancy only counts units/listings that have something on the books.
  const live = groupList.length;
  const n30 = groupList.reduce((a, g) => a + g.next30, 0);
  const n90 = groupList.reduce((a, g) => a + g.next90, 0);

  return {
    today,
    months,
    monthLabels: months.map((m) =>
      months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4) ? `${labelMonth(m, false)} '${m.slice(2, 4)}` : labelMonth(m, false)
    ),
    monthAvail,
    count: rows.length,
    net,
    gross,
    nights,
    avgStay: rows.length ? nights / rows.length : 0,
    adr: adrDen ? adrNum / adrDen : 0,
    leadMedian: median(leads),
    stayingNow,
    furthest: rows.length ? rows.reduce((a, r) => (r.checkOut > a ? r.checkOut : a), rows[0].checkOut) : null,
    next30: { nights: n30, avail: live * 30, rate: live ? n30 / (live * 30) : 0 },
    next90: { nights: n90, avail: live * 90, rate: live ? n90 / (live * 90) : 0 },
    monthly,
    groups: groupList,
    stays: rows,
    unlinked: groupList.filter((g) => !g.unitId).length,
  };
}
