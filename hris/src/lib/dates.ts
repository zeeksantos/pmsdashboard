// Dates are plain YYYY-MM-DD strings in Asia/Manila; these helpers avoid timezone drift.

export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function manilaMinutesNow(): number {
  const t = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Manila",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return timeToMinutes(t);
}

// The most recently completed semi-monthly period (1st-15th or 16th-end), as a default for new runs.
export function suggestPeriod(today: string): { start: string; end: string } {
  const [y, m, d] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d >= 16) return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-15` };
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return { start: `${py}-${pad(pm)}-16`, end: `${py}-${pad(pm)}-${pad(last)}` };
}
