// Value parsing for channel exports: money, dates and row fingerprints.
// Pure functions shared by the browser preview and the server import.

const CURRENCY_SYMBOLS: Record<string, string> = {
  "₱": "PHP",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₩": "KRW",
};

export interface Money {
  value: number;
  currency: string | null;
}

/**
 * Parses amounts like "1,234.56", "₱1,234", "PHP 1,234.00", "1.234,56 EUR",
 * "(250.00)" (negative) or "-250". Returns null for blanks and non-numbers.
 */
export function parseMoney(raw: string | null | undefined): Money | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "—") return null;

  let currency: string | null = null;
  const code = s.match(/\b([A-Z]{3})\b/);
  if (code) currency = code[1];
  for (const [symbol, iso] of Object.entries(CURRENCY_SYMBOLS)) {
    if (s.includes(symbol)) {
      currency = currency ?? iso;
      break;
    }
  }

  const compact = s.replace(/\s+/g, "");
  // "(250.00)", "-250", "PHP -250", "-₱250", "250-"
  const negative = /^\(.*\)$/.test(compact) || /^[^\d]*[-−]/.test(compact) || /[-−]$/.test(compact);
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal point.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) ?? []).length;
    // "1,234" / "1,234,567" are thousands; "12,5" / "1234,56" are decimals.
    s = commaCount === 1 && decimals !== 3 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1) s = s.replace(/\./g, ""); // "1.234.567"
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return { value: round2(negative ? -value : value), currency };
}

export function parseAmount(raw: string | null | undefined): number | null {
  return parseMoney(raw)?.value ?? null;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function monthNumber(name: string): number | null {
  const key = name.toLowerCase();
  return MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)] ?? null;
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. 31 Feb
  return `${y.toString().padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Parses the date formats channel exports use. Slash/dash numeric dates are
 * ambiguous; `dayFirst` picks DD/MM/YYYY over MM/DD/YYYY (see inferDayFirst).
 */
export function parseDate(raw: string | null | undefined, dayFirst = false): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    return dayFirst ? iso(+m[3], b, a) : iso(+m[3], a, b);
  }

  // "Sep 1, 2026", "September 01 2026"
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m) {
    const month = monthNumber(m[1]);
    if (month) return iso(+m[3], month, +m[2]);
  }

  // "1 Sep 2026", "01-Sep-2026", "1 September, 2026"
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{2,4})/);
  if (m) {
    const month = monthNumber(m[2]);
    if (month) return iso(+m[3], month, +m[1]);
  }

  return null;
}

/**
 * Looks at every numeric date in a column: if any first part is > 12 the
 * file is day-first (DD/MM); if any second part is > 12 it's month-first.
 * Defaults to month-first, which is what Airbnb exports use.
 */
export function inferDayFirst(values: string[]): boolean {
  for (const v of values) {
    const m = String(v).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) return true;
    if (+m[2] > 12) return false;
  }
  return false;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(Date.parse(isoDate + "T00:00:00Z") + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// cyrb53 — small, fast, well-distributed string hash. Two seeds give a
// ~106-bit fingerprint, plenty to tell export rows apart.
function cyrb53(str: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function fingerprint(parts: (string | number | null | undefined)[]): string {
  const s = parts.map((p) => (p == null ? "" : String(p).trim().toLowerCase())).join("␟");
  return cyrb53(s, 1) + cyrb53(s, 7);
}
