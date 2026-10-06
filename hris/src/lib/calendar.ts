// Calendar helpers. Dates are plain YYYY-MM-DD strings; everything is computed in UTC so the
// result never shifts with the server's timezone.

const pad = (n: number) => String(n).padStart(2, "0");

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-12
}

// Weeks (Sunday first) of a month; days outside the month are null.
export function monthGrid(year: number, month: number): (string | null)[][] {
  const leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const cells: (string | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Every date from start to end, inclusive (capped, so a bad range can't run away).
export function expandRange(start: string, end: string): string[] {
  const out: string[] = [];
  const last = Date.parse(`${end}T00:00:00Z`);
  for (let t = Date.parse(`${start}T00:00:00Z`), i = 0; t <= last && i < 400; t += 86_400_000, i++) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function monthOf(date: string): { year: number; month: number; first: string; last: string } {
  const [year, month] = date.split("-").map(Number);
  return { year, month, first: `${year}-${pad(month)}-01`, last: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}` };
}

export function monthTitle(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
