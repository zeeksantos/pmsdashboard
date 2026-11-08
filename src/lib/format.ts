const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "symbol",
  minimumFractionDigits: 2,
});

export function formatPeso(amount: number): string {
  return pesoFormatter.format(amount);
}

const manilaDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
});

export function formatManilaDate(iso: string): string {
  return manilaDateFormatter.format(new Date(iso));
}

const manilaDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatManilaDateTime(iso: string): string {
  return manilaDateTimeFormatter.format(new Date(iso));
}

const wholeFormatters = new Map<string, Intl.NumberFormat>();

/** Whole-unit money for analytics (₱12,345). Negative values keep their sign. */
export function formatMoney(amount: number, currency = "PHP"): string {
  let f = wholeFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    wholeFormatters.set(currency, f);
  }
  return f.format(Math.round(amount) === 0 ? 0 : amount);
}

export function formatPercent(ratio: number | null, digits = 0): string {
  return ratio == null ? "—" : `${(ratio * 100).toFixed(digits)}%`;
}
