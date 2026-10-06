import { monthGrid, monthTitle } from "@/lib/calendar";
import { cn } from "@/lib/cn";

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar({
  year,
  month,
  today,
  approved = [],
  pending = [],
}: {
  year: number;
  month: number; // 1-12
  today: string; // YYYY-MM-DD
  approved?: string[];
  pending?: string[];
}) {
  const weeks = monthGrid(year, month);
  const ap = new Set(approved);
  const pe = new Set(pending);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">{monthTitle(year, month)}</h3>
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-xs">
        {weekdays.map((d, i) => (
          <span key={i} className="pb-1 text-muted">{d}</span>
        ))}
        {weeks.flat().map((d, i) =>
          d === null ? (
            <span key={i} />
          ) : (
            <span
              key={i}
              title={ap.has(d) ? "Approved leave" : pe.has(d) ? "Leave awaiting approval" : undefined}
              className={cn(
                "mx-auto flex h-7 w-7 items-center justify-center rounded-full",
                d === today && "bg-accent font-semibold text-accent-foreground",
                d !== today && ap.has(d) && "bg-success/20 font-medium text-success",
                d !== today && !ap.has(d) && pe.has(d) && "bg-warning/20 font-medium text-warning"
              )}
            >
              {Number(d.slice(8))}
            </span>
          )
        )}
      </div>
      {(ap.size > 0 || pe.size > 0) && (
        <p className="mt-3 flex gap-3 text-xs text-muted">
          <span className="text-success">● Approved leave</span>
          <span className="text-warning">● Pending</span>
        </p>
      )}
    </section>
  );
}
