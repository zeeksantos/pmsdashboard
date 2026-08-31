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
