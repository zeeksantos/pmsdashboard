export type CalendarView = "day" | "week" | "month";

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getManilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const manilaDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });

export function toManilaDateString(iso: string): string {
  return manilaDayFormatter.format(new Date(iso));
}

export function getLastNDays(n: number, endDateStr: string): string[] {
  const end = parseDate(endDateStr);
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(formatDate(addDays(end, -i)));
  }
  return days;
}

export function getRange(view: CalendarView, dateStr: string): { start: string; end: string; days: string[] } {
  const date = parseDate(dateStr);
  let start: Date;
  let end: Date;

  if (view === "day") {
    start = date;
    end = date;
  } else if (view === "week") {
    const dayOfWeek = date.getUTCDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    start = addDays(date, -diffToMonday);
    end = addDays(start, 6);
  } else {
    start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  }

  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(formatDate(cursor));
  }

  return { start: formatDate(start), end: formatDate(end), days };
}

export function shiftDate(dateStr: string, view: CalendarView, direction: 1 | -1): string {
  const date = parseDate(dateStr);
  if (view === "day") return formatDate(addDays(date, direction));
  if (view === "week") return formatDate(addDays(date, direction * 7));
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1));
  return formatDate(next);
}

export function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(date);
}

export function formatRangeLabel(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const startDate = new Date(Date.UTC(ys, ms - 1, ds));
  const endDate = new Date(Date.UTC(ye, me - 1, de));
  const fmt = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  return start === end ? fmt.format(startDate) : `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
}
