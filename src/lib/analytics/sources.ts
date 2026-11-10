// Where a booking came from. OTA rows are labelled by their channel;
// direct bookings (and CSV rows with a "Source" column) carry their own
// source, normalised here so "fb", "FB page" and "Facebook" group together.

export const DIRECT_SOURCES = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Messenger",
  "Viber / WhatsApp",
  "Website",
  "Google",
  "Referral",
  "Repeat guest",
  "Walk-in",
  "Other",
] as const;

export const PAYMENT_METHODS = ["GCash", "Maya", "Cash", "Bank transfer", "Card", "Other"] as const;

export const OTA_SOURCES = new Set(["Airbnb", "Booking.com", "Agoda", "Vrbo", "Expedia", "Trip.com"]);

const CHANNEL_SOURCE: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  agoda: "Agoda",
  direct: "Other",
  other: "Other",
};

const ALIASES: [RegExp, string][] = [
  [/^(fb|facebook|fb page|facebook page|meta)\b/i, "Facebook"],
  [/^(ig|insta|instagram)\b/i, "Instagram"],
  [/^(tiktok|tik tok|tt)\b/i, "TikTok"],
  [/^(messenger|fb messenger|m\.me)\b/i, "Messenger"],
  [/^(viber|whatsapp|whats app|telegram|sms|text)\b/i, "Viber / WhatsApp"],
  [/^(web|website|site|direct website|own website)\b/i, "Website"],
  [/^(google|google maps|gmb|google business)\b/i, "Google"],
  [/^(referral|referred|friend|word of mouth)\b/i, "Referral"],
  [/^(repeat|returning|repeat guest|returning guest)\b/i, "Repeat guest"],
  [/^(walk[- ]?in)\b/i, "Walk-in"],
  [/^airbnb\b/i, "Airbnb"],
  [/^booking(\.com)?\b/i, "Booking.com"],
  [/^agoda\b/i, "Agoda"],
  [/^vrbo\b/i, "Vrbo"],
  [/^expedia\b/i, "Expedia"],
  [/^trip(\.com)?\b/i, "Trip.com"],
];

/** Tidies a free-text source into one of the known labels where possible. */
export function normaliseSource(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  for (const [re, label] of ALIASES) if (re.test(s)) return label;
  return s.length > 40 ? s.slice(0, 40) : s.charAt(0).toUpperCase() + s.slice(1);
}

/** The source label a transaction is reported under. */
export function sourceOf(channel: string, source: string | null | undefined): string {
  return normaliseSource(source) ?? CHANNEL_SOURCE[channel] ?? "Other";
}

export const isDirect = (label: string) => !OTA_SOURCES.has(label);

const COLORS: Record<string, string> = {
  Airbnb: "#D9534F",
  "Booking.com": "#2F5FA8",
  Agoda: "#7B4FA0",
  Facebook: "#1877F2",
  Instagram: "#C13584",
  TikTok: "#16232B",
  Messenger: "#0E8C8E",
  "Viber / WhatsApp": "#5E4BA8",
  Website: "#5B7F3A",
  Google: "#B8860B",
  Referral: "#A3542F",
  "Repeat guest": "#1F8A55",
  "Walk-in": "#7A8890",
};
const EXTRA = ["#3A4F7C", "#8A5A9E", "#7FB3B4", "#C08A3E", "#4F5F68"];

export function sourceColor(label: string, index = 0): string {
  return COLORS[label] ?? (label === "Other" ? "#9AA5AB" : EXTRA[index % EXTRA.length]);
}
