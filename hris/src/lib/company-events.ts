export type CompanyEventKind = "EVENT" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";

export const companyEventKinds: CompanyEventKind[] = ["EVENT", "REGULAR_HOLIDAY", "SPECIAL_HOLIDAY"];

export const companyKindLabels: Record<CompanyEventKind, string> = {
  EVENT: "Company event",
  REGULAR_HOLIDAY: "Regular holiday",
  SPECIAL_HOLIDAY: "Special non-working holiday",
};

export type CompanyEventRow = {
  id: string;
  title: string;
  kind: CompanyEventKind;
  start_date: string;
  end_date: string;
  note: string | null;
};

const iso = /^\d{4}-\d{2}-\d{2}$/;

// Returns an error message, or null when the entry is acceptable.
export function validateCompanyEvent(input: { title: string; kind: string; start: string; end: string; note: string }): string | null {
  if (!input.title.trim()) return "Enter a title.";
  if (input.title.trim().length > 120) return "The title is too long (120 characters at most).";
  if (!companyEventKinds.includes(input.kind as CompanyEventKind)) return "Choose a type.";
  if (!iso.test(input.start) || Number.isNaN(Date.parse(`${input.start}T00:00:00Z`))) return "Enter a start date.";
  if (input.end && (!iso.test(input.end) || Number.isNaN(Date.parse(`${input.end}T00:00:00Z`)))) return "Enter a valid end date.";
  if (input.end && input.end < input.start) return "The end date can't be before the start date.";
  if (input.note.length > 500) return "The note is too long (500 characters at most).";
  return null;
}
