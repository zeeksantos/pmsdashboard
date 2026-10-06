import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";
import { formatDate, manilaToday } from "@/lib/format";
import { companyKindLabels, type CompanyEventRow } from "@/lib/company-events";
import { cn } from "@/lib/cn";
import { AddEventForm } from "./AddEventForm";
import { deleteCompanyEvent } from "./actions";

const badge: Record<CompanyEventRow["kind"], string> = {
  EVENT: "bg-accent/15 text-accent",
  REGULAR_HOLIDAY: "bg-danger/15 text-danger",
  SPECIAL_HOLIDAY: "bg-warning/15 text-warning",
};

export default async function CompanyCalendarPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const me = await getCurrentUser();
  if (!me) return null;

  const today = manilaToday();
  const { year: yearParam } = await searchParams;
  const parsed = Number(yearParam);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : Number(today.slice(0, 4));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_events")
    .select("id, title, kind, start_date, end_date, note")
    .lte("start_date", `${year}-12-31`)
    .gte("end_date", `${year}-01-01`)
    .order("start_date")
    .order("title");
  const rows = (data ?? []) as CompanyEventRow[];
  const canEdit = canManageRecords(me.role);
  const tab = "rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Company Calendar</h1>
          <p className="mt-1 text-sm text-muted">
            Company events and Philippine holidays: regular holidays and special non-working holidays. These also show
            on the dashboard calendar.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/company-calendar?year=${year - 1}`} className={tab}>← {year - 1}</Link>
          <span className="px-2 text-sm font-semibold">{year}</span>
          <Link href={`/company-calendar?year=${year + 1}`} className={tab}>{year + 1} →</Link>
        </div>
      </div>

      {canEdit && <AddEventForm today={today} />}

      <section className="rounded-2xl border border-border bg-surface">
        {error && <p className="p-4 text-sm text-danger">{error.message}</p>}
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nothing on the calendar for {year} yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className={cn("flex flex-wrap items-start justify-between gap-3 p-4", r.end_date < today && "opacity-60")}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted">
                    {formatDate(r.start_date)}
                    {r.end_date !== r.start_date && ` – ${formatDate(r.end_date)}`}
                    {r.note && ` · ${r.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", badge[r.kind])}>{companyKindLabels[r.kind]}</span>
                  {canEdit && (
                    <form action={deleteCompanyEvent}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-xs text-muted hover:text-danger" aria-label={`Remove ${r.title}`}>Remove</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">
        Regular and special non-working holidays are listed for 2026 and 2027. Eid&apos;l Fitr and Eid&apos;l Adha are
        proclaimed each year: the 2026 dates are the proclaimed ones and the 2027 dates are tentative, so check them
        once the proclamation is out. Other holidays that are proclaimed yearly (such as Chinese New Year and All
        Souls&apos; Day) aren&apos;t pre-filled, so add them here. The calendar only shows holidays. Payroll still
        treats them as normal days.
      </p>
    </div>
  );
}
