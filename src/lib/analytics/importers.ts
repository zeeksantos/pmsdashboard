// Turns channel earnings exports (Airbnb, Booking.com, Agoda, or any CSV
// with stay rows) into one normalised transaction shape.
//
// Airbnb's "Transaction history" CSV is a ledger: one row per reservation,
// payout, adjustment, co-host payout… Booking.com and Agoda exports are one
// row per reservation. Unknown layouts can be imported by mapping columns
// by hand (ParseOptions.mapping).

import { parseCsv } from "./csv.ts";
import { fingerprint, inferDayFirst, nightsBetween, parseDate, parseMoney, round2 } from "./values.ts";

export type Channel = "airbnb" | "booking" | "agoda" | "other";

export const CHANNEL_LABELS: Record<Channel, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  agoda: "Agoda",
  other: "Other / direct",
};

export type TxnKind =
  | "booking"
  | "payout"
  | "adjustment"
  | "resolution"
  | "cancellation"
  | "cohost"
  | "tax"
  | "other";

export const KIND_LABELS: Record<TxnKind, string> = {
  booking: "Booking",
  payout: "Payout",
  adjustment: "Adjustment",
  resolution: "Resolution",
  cancellation: "Cancellation fee",
  cohost: "Co-host payout",
  tax: "Tax",
  other: "Other",
};

export interface NormalizedTxn {
  channel: Channel;
  kind: TxnKind;
  rawType: string | null;
  date: string;
  code: string | null;
  guest: string | null;
  listing: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  currency: string;
  /** Host earnings for this line, in `currency`. 0 for payouts. */
  amount: number;
  gross: number | null;
  serviceFee: number | null;
  cleaningFee: number | null;
  taxes: number | null;
  paidOut: number | null;
  details: string | null;
  dedupeKey: string;
}

export type FieldKey =
  | "date"
  | "type"
  | "code"
  | "checkIn"
  | "checkOut"
  | "nights"
  | "guest"
  | "listing"
  | "details"
  | "currency"
  | "amount"
  | "paidOut"
  | "serviceFee"
  | "cleaningFee"
  | "gross"
  | "taxes"
  | "commission"
  | "status"
  | "bookedOn";

export const FIELD_LABELS: Record<FieldKey, string> = {
  date: "Transaction date",
  type: "Transaction type",
  code: "Booking / confirmation number",
  checkIn: "Check-in date",
  checkOut: "Check-out date",
  nights: "Nights",
  guest: "Guest name",
  listing: "Listing / room type",
  details: "Details",
  currency: "Currency",
  amount: "Net payout to host",
  paidOut: "Paid out",
  serviceFee: "Service fee",
  cleaningFee: "Cleaning fee",
  gross: "Gross price",
  taxes: "Taxes",
  commission: "Commission amount",
  status: "Status",
  bookedOn: "Booked on",
};

/** Fields offered in the manual column-mapping step for stay-row files. */
export const STAY_MAPPING_FIELDS: FieldKey[] = [
  "code",
  "checkIn",
  "checkOut",
  "listing",
  "guest",
  "amount",
  "gross",
  "commission",
  "currency",
  "status",
  "nights",
  "bookedOn",
];

export type ColumnMapping = Partial<Record<FieldKey, string>>;

export interface ParseOptions {
  /** Force a channel instead of auto-detecting it. */
  channel?: Channel;
  /** Header name for each field; overrides the built-in aliases. */
  mapping?: ColumnMapping;
  /** Listing name for files without a listing/room column. */
  defaultListing?: string;
  /** Currency for files without a currency column. Defaults to PHP. */
  defaultCurrency?: string;
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  channel: Channel | null;
  headers: string[];
  mapping: ColumnMapping;
  /** Required fields that couldn't be found (manual mapping needed). */
  missing: FieldKey[];
  rows: NormalizedTxn[];
  totalRows: number;
  skipped: { reason: string; count: number }[];
  warnings: string[];
  currencies: Record<string, number>;
  listings: string[];
  periodStart: string | null;
  periodEnd: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Header matching
// ─────────────────────────────────────────────────────────────────────────

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/%/g, "pct").replace(/[^a-z0-9]/g, "");
}

type Aliases = Partial<Record<FieldKey, string[]>>;

const AIRBNB_ALIASES: Aliases = {
  date: ["date"],
  type: ["type"],
  code: ["confirmationcode"],
  checkIn: ["startdate"],
  checkOut: ["enddate"],
  nights: ["nights"],
  guest: ["guest", "guestname"],
  listing: ["listing"],
  details: ["details"],
  currency: ["currency"],
  amount: ["amount"],
  paidOut: ["paidout"],
  serviceFee: ["servicefee", "hostservicefee"],
  cleaningFee: ["cleaningfee"],
  gross: ["grossearnings"],
  taxes: ["occupancytaxes", "occupancytax"],
  bookedOn: ["bookingdate"],
};

const BOOKING_ALIASES: Aliases = {
  code: ["booknumber", "bookingnumber", "reservationnumber", "reservationid", "bookingid"],
  guest: ["guestname", "guestnames", "guestsname", "bookedby"],
  checkIn: ["checkin", "checkindate", "arrival", "arrivaldate"],
  checkOut: ["checkout", "checkoutdate", "departure", "departuredate"],
  bookedOn: ["bookedon", "bookingdate", "reservationdate", "createdon"],
  status: ["status", "reservationstatus", "bookingstatus"],
  amount: ["netamount", "payoutamount", "netprice", "netrevenue"],
  gross: ["price", "totalprice", "finalamount", "totalamount", "roomprice", "amount"],
  commission: ["commissionamount", "commission"],
  listing: ["unittype", "roomtype", "roomname", "room", "propertyname", "property", "unit"],
  nights: ["durationnights", "nights", "roomnights", "lengthofstay", "duration"],
  currency: ["currency", "currencycode"],
};

const AGODA_ALIASES: Aliases = {
  code: ["bookingid", "bookingno", "bookingnumber", "reservationid", "confirmationno", "bookingreference"],
  guest: ["guestname", "customername", "leadguest", "leadguestname", "guest"],
  checkIn: ["checkin", "checkindate", "arrival", "arrivaldate", "staydatefrom"],
  checkOut: ["checkout", "checkoutdate", "departure", "departuredate", "staydateto"],
  bookedOn: ["bookeddate", "bookingdate", "bookedon", "bookingdatetime"],
  status: ["status", "bookingstatus"],
  amount: [
    "netrate", "netamount", "totalnetrate", "netinclusive", "netinclusiveamount",
    "payoutamount", "suppliernetamount", "netprice",
  ],
  gross: ["sellinclusive", "sellinclusiveamount", "sellingrate", "sellrate", "grossamount", "totalamount", "totalprice"],
  commission: ["commissionamount", "commission"],
  listing: ["roomtype", "roomtypename", "room", "propertyname", "hotelname", "property"],
  nights: ["nights", "roomnights", "noofnights", "numberofnights", "lengthofstay"],
  currency: ["currency", "currencycode"],
};

const OTHER_ALIASES: Aliases = (() => {
  const merged: Aliases = {};
  for (const source of [BOOKING_ALIASES, AGODA_ALIASES]) {
    for (const [key, list] of Object.entries(source) as [FieldKey, string[]][]) {
      merged[key] = Array.from(new Set([...(merged[key] ?? []), ...list]));
    }
  }
  return merged;
})();

const ALIASES: Record<Channel, Aliases> = {
  airbnb: AIRBNB_ALIASES,
  booking: BOOKING_ALIASES,
  agoda: AGODA_ALIASES,
  other: OTHER_ALIASES,
};

function autoMapping(headers: string[], aliases: Aliases): ColumnMapping {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h);
  }
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const [field, list] of Object.entries(aliases) as [FieldKey, string[]][]) {
    for (const alias of list) {
      const header = byNorm.get(alias);
      if (header && !used.has(header)) {
        mapping[field] = header;
        used.add(header);
        break;
      }
    }
  }
  return mapping;
}

export function detectChannel(headers: string[]): Channel | null {
  const n = new Set(headers.map(normalizeHeader));
  const has = (...keys: string[]) => keys.some((k) => n.has(k));

  if (has("confirmationcode") && (has("paidout", "grossearnings") || (has("type") && has("listing")))) {
    return "airbnb";
  }
  if (has("booknumber") || (has("commissionamount") && has("bookedon", "unittype"))) {
    return "booking";
  }
  if (
    has("bookingid", "bookingno") &&
    has("netrate", "netinclusive", "sellinclusive", "totalnetrate", "suppliernetamount", "netinclusiveamount")
  ) {
    return "agoda";
  }
  if (headers.some((h) => /agoda/i.test(h))) return "agoda";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────

function airbnbKind(rawType: string): TxnKind {
  const t = rawType.toLowerCase().trim();
  if (t === "reservation" || t === "booking") return "booking";
  if (t === "payout") return "payout";
  if (t.includes("co-host") || t.includes("cohost")) return "cohost";
  if (t.startsWith("resolution")) return "resolution";
  if (t.includes("cancellation")) return "cancellation";
  if (t.includes("adjustment")) return "adjustment";
  if (t.includes("tax") || t.includes("tot") || t.includes("remitted")) return "tax";
  return "other";
}

function isCancelledStatus(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("cancel") || s.includes("no_show") || s.includes("no show") || s.includes("noshow") || s.includes("rejected");
}

class Skips {
  private counts = new Map<string, number>();
  add(reason: string) {
    this.counts.set(reason, (this.counts.get(reason) ?? 0) + 1);
  }
  list() {
    return Array.from(this.counts, ([reason, count]) => ({ reason, count }));
  }
}

function cleanText(v: string | undefined): string | null {
  const s = (v ?? "").replace(/‌/g, "").trim();
  return s ? s : null;
}

export function parseExport(text: string, options: ParseOptions = {}): ParseResult {
  const empty = (error: string, headers: string[] = [], mapping: ColumnMapping = {}, missing: FieldKey[] = [], channel: Channel | null = null): ParseResult => ({
    ok: false,
    error,
    channel,
    headers,
    mapping,
    missing,
    rows: [],
    totalRows: 0,
    skipped: [],
    warnings: [],
    currencies: {},
    listings: [],
    periodStart: null,
    periodEnd: null,
  });

  const table = parseCsv(text);
  if (table.length < 2) return empty("The file has no data rows.");

  // Some exports put a title line above the real header row: use the first
  // row (within the first 5) that looks most like a header.
  let headerIndex = 0;
  for (let i = 0; i < Math.min(5, table.length - 1); i++) {
    if (detectChannel(table[i])) {
      headerIndex = i;
      break;
    }
  }
  const headers = table[headerIndex].map((h) => h.trim());
  const body = table.slice(headerIndex + 1);

  const channel = options.channel ?? detectChannel(headers);
  const aliasSet = ALIASES[channel ?? "other"];
  const mapping: ColumnMapping = { ...autoMapping(headers, aliasSet), ...cleanMapping(options.mapping, headers) };

  const required: FieldKey[] =
    channel === "airbnb" ? ["date", "type"] : ["checkIn", "checkOut"];
  const missing = required.filter((f) => !mapping[f]);
  if (channel !== "airbnb" && !mapping.amount && !mapping.gross) missing.push("amount");
  if (!channel) {
    return empty(
      "We couldn't recognise this file. Pick the channel and match the columns below.",
      headers,
      mapping,
      missing,
      null
    );
  }
  if (missing.length > 0) {
    return empty(
      `Some required columns weren't found: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}. Match them below.`,
      headers,
      mapping,
      missing,
      channel
    );
  }

  const col = new Map<FieldKey, number>();
  for (const [field, header] of Object.entries(mapping) as [FieldKey, string][]) {
    const idx = headers.indexOf(header);
    if (idx >= 0) col.set(field, idx);
  }
  const get = (row: string[], field: FieldKey) => {
    const idx = col.get(field);
    return idx == null ? undefined : row[idx];
  };

  const dateColumns: FieldKey[] = ["date", "checkIn", "checkOut", "bookedOn"];
  const dayFirst = inferDayFirst(
    body.flatMap((r) => dateColumns.map((f) => get(r, f) ?? "")).filter(Boolean)
  );

  const skips = new Skips();
  const warnings: string[] = [];
  const rows: NormalizedTxn[] = [];
  const occurrences = new Map<string, number>();
  const defaultCurrency = (options.defaultCurrency ?? "PHP").toUpperCase();

  const pushRow = (row: Omit<NormalizedTxn, "dedupeKey">, keyParts: (string | number | null)[]) => {
    const base = fingerprint(keyParts);
    // Identical ledger rows inside one file (rare, but possible) are kept
    // apart by their position among duplicates.
    const n = occurrences.get(base) ?? 0;
    occurrences.set(base, n + 1);
    rows.push({ ...row, dedupeKey: n === 0 ? base : `${base}-${n}` });
  };

  if (channel === "airbnb") {
    for (const r of body) {
      const rawType = cleanText(get(r, "type"));
      const date = parseDate(get(r, "date"), dayFirst);
      if (!date) {
        skips.add("No transaction date");
        continue;
      }
      if (!rawType) {
        skips.add("No transaction type");
        continue;
      }
      const kind = airbnbKind(rawType);
      const amountMoney = parseMoney(get(r, "amount"));
      const paidOutMoney = parseMoney(get(r, "paidOut"));
      const currency = (
        cleanText(get(r, "currency")) ?? amountMoney?.currency ?? paidOutMoney?.currency ?? defaultCurrency
      ).toUpperCase();
      const checkIn = parseDate(get(r, "checkIn"), dayFirst);
      const checkOut = parseDate(get(r, "checkOut"), dayFirst);
      const nightsRaw = parseMoney(get(r, "nights"))?.value ?? null;
      const nights =
        nightsRaw != null ? Math.round(nightsRaw) : checkIn && checkOut ? nightsBetween(checkIn, checkOut) : null;
      const amount = kind === "payout" ? 0 : amountMoney?.value ?? 0;
      const paidOut = paidOutMoney?.value ?? null;
      if (kind !== "payout" && amountMoney == null && paidOut == null) {
        skips.add("No amount");
        continue;
      }
      const row = {
        channel,
        kind,
        rawType,
        date,
        code: cleanText(get(r, "code")),
        guest: cleanText(get(r, "guest")),
        listing: kind === "payout" ? null : cleanText(get(r, "listing")),
        checkIn,
        checkOut,
        nights,
        currency,
        amount,
        gross: parseMoney(get(r, "gross"))?.value ?? null,
        serviceFee: parseMoney(get(r, "serviceFee"))?.value ?? null,
        cleaningFee: parseMoney(get(r, "cleaningFee"))?.value ?? null,
        taxes: parseMoney(get(r, "taxes"))?.value ?? null,
        paidOut,
        details: cleanText(get(r, "details")),
      };
      pushRow(row, [
        "airbnb", date, rawType, row.code, checkIn, checkOut, row.listing, row.details,
        amountMoney?.value ?? null, paidOut, currency,
      ]);
    }
  } else {
    let usedGrossOnly = false;
    for (const r of body) {
      const status = cleanText(get(r, "status"));
      if (isCancelledStatus(status)) {
        skips.add("Cancelled / no-show (not counted)");
        continue;
      }
      const checkIn = parseDate(get(r, "checkIn"), dayFirst);
      const checkOut = parseDate(get(r, "checkOut"), dayFirst);
      if (!checkIn || !checkOut) {
        skips.add("Missing check-in or check-out date");
        continue;
      }
      const net = parseMoney(get(r, "amount"));
      const gross = parseMoney(get(r, "gross"));
      const commission = parseMoney(get(r, "commission"));
      let amount: number | null = null;
      if (net) amount = net.value;
      else if (gross && commission) amount = round2(gross.value - Math.abs(commission.value));
      else if (gross) {
        amount = gross.value;
        usedGrossOnly = true;
      }
      if (amount == null) {
        skips.add("No amount");
        continue;
      }
      const currency = (
        cleanText(get(r, "currency")) ?? net?.currency ?? gross?.currency ?? defaultCurrency
      ).toUpperCase();
      const nightsRaw = parseMoney(get(r, "nights"))?.value ?? null;
      const stayNights = nightsBetween(checkIn, checkOut);
      const code = cleanText(get(r, "code"));
      const listing = cleanText(get(r, "listing")) ?? cleanText(options.defaultListing) ?? "Unassigned listing";
      const row = {
        channel,
        kind: "booking" as const,
        rawType: status,
        date: parseDate(get(r, "bookedOn"), dayFirst) ?? checkIn,
        code,
        guest: cleanText(get(r, "guest")),
        listing,
        checkIn,
        checkOut,
        nights: stayNights > 0 ? stayNights : nightsRaw != null ? Math.round(nightsRaw) : 0,
        currency,
        amount,
        gross: gross?.value ?? null,
        serviceFee: commission ? Math.abs(commission.value) : null,
        cleaningFee: null,
        taxes: null,
        paidOut: null,
        details: null,
      };
      // Keyed on the reservation itself, not the amount: a newer export of
      // the same booking (modified price) updates it instead of duplicating.
      pushRow(row, [channel, code ?? `${row.guest}|${checkIn}`, checkIn, checkOut, listing]);
    }
    if (usedGrossOnly) {
      warnings.push(
        "No net payout or commission column was found, so the full guest price is counted as your earnings. Map the commission column to subtract the channel's cut."
      );
    }
  }

  if (rows.length === 0) {
    const reasons = skips.list().map((s) => `${s.count} × ${s.reason}`).join(", ");
    return { ...empty(`No usable rows were found${reasons ? ` (${reasons})` : ""}.`, headers, mapping, [], channel), totalRows: body.length, skipped: skips.list() };
  }

  const currencies: Record<string, number> = {};
  const listingSet = new Set<string>();
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  for (const row of rows) {
    if (row.kind !== "payout") currencies[row.currency] = (currencies[row.currency] ?? 0) + 1;
    if (row.listing) listingSet.add(row.listing);
    if (!periodStart || row.date < periodStart) periodStart = row.date;
    if (!periodEnd || row.date > periodEnd) periodEnd = row.date;
  }

  return {
    ok: true,
    channel,
    headers,
    mapping,
    missing: [],
    rows,
    totalRows: body.length,
    skipped: skips.list(),
    warnings,
    currencies,
    listings: Array.from(listingSet).sort((a, b) => a.localeCompare(b)),
    periodStart,
    periodEnd,
  };
}

function cleanMapping(mapping: ColumnMapping | undefined, headers: string[]): ColumnMapping {
  const out: ColumnMapping = {};
  if (!mapping) return out;
  for (const [field, header] of Object.entries(mapping) as [FieldKey, string | undefined][]) {
    if (header && headers.includes(header)) out[field] = header;
  }
  return out;
}

/** Currencies (other than the base) that need an exchange rate to import. */
export function foreignCurrencies(result: ParseResult, base = "PHP"): string[] {
  return Object.keys(result.currencies).filter((c) => c !== base).sort();
}
