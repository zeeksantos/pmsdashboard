const TZ = "Asia/Manila";

export function manilaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function mapLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
