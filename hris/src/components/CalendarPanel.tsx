"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGrid, monthTitle, shiftMonth, type CalendarEvent, type CalendarEventKind } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { loadMonthEvents } from "@/app/(app)/calendar-actions";

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

const dot: Record<CalendarEventKind, string> = {
  leave: "bg-success",
  "leave-pending": "bg-warning",
  "team-leave": "bg-muted",
  attendance: "bg-accent",
  birthday: "bg-danger",
  anniversary: "bg-accent",
  contract: "bg-danger",
  regularization: "bg-warning",
};

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

function longDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export function CalendarPanel({
  year, month, today, events,
}: { year: number; month: number; today: string; events: CalendarEvent[] }) {
  const [view, setView] = useState({ year, month });
  const [cache, setCache] = useState<Record<string, CalendarEvent[]>>({ [key(year, month)]: events });
  const [selected, setSelected] = useState<string | null>(today);
  const [failed, setFailed] = useState(false);
  const [loading, startLoading] = useTransition();

  function go(next: { year: number; month: number }) {
    setSelected(key(next.year, next.month) === today.slice(0, 7) ? today : null);
    setView(next);
    setFailed(false);
    const k = key(next.year, next.month);
    if (cache[k]) return;
    startLoading(async () => {
      try {
        const loaded = await loadMonthEvents(next.year, next.month);
        setCache((c) => ({ ...c, [k]: loaded }));
      } catch {
        setFailed(true);
      }
    });
  }

  const monthEvents = cache[key(view.year, view.month)];
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of monthEvents ?? []) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const dayEvents = selected ? (byDate.get(selected) ?? []) : [];
  const nav = "rounded-lg p-1.5 text-muted hover:bg-surface-raised hover:text-foreground";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{monthTitle(view.year, view.month)}</h3>
        <div className="flex items-center gap-1">
          {key(view.year, view.month) !== today.slice(0, 7) && (
            <button type="button" onClick={() => go({ year, month })} className="mr-1 text-xs text-accent hover:underline">
              Today
            </button>
          )}
          <button type="button" aria-label="Previous month" className={nav} onClick={() => go(shiftMonth(view.year, view.month, -1))}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" aria-label="Next month" className={nav} onClick={() => go(shiftMonth(view.year, view.month, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className={cn("mt-3 grid grid-cols-7 gap-y-1 text-center text-xs", loading && "opacity-60")}>
        {weekdays.map((d, i) => (<span key={i} className="pb-1 text-muted">{d}</span>))}
        {monthGrid(view.year, view.month).flat().map((d, i) => {
          if (d === null) return <span key={i} />;
          const list = byDate.get(d) ?? [];
          const kinds = [...new Set(list.map((e) => e.kind))].slice(0, 3);
          return (
            <button
              key={i} type="button" onClick={() => setSelected(d)} aria-pressed={selected === d}
              aria-label={`${longDate(d)}${list.length ? `, ${list.length} event${list.length === 1 ? "" : "s"}` : ""}`}
              className={cn(
                "mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full leading-none transition-colors hover:bg-surface-raised",
                d === today && "bg-accent font-semibold text-accent-foreground hover:bg-accent",
                selected === d && d !== today && "ring-2 ring-accent"
              )}
            >
              {Number(d.slice(8))}
              <span className="mt-0.5 flex h-1 gap-0.5">
                {kinds.map((k) => (<span key={k} className={cn("h-1 w-1 rounded-full", d === today ? "bg-accent-foreground" : dot[k])} />))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border pt-3" aria-live="polite">
        {failed ? (
          <p className="text-sm text-danger">Couldn&apos;t load this month. Try again.</p>
        ) : selected ? (
          <>
            <p className="text-sm font-medium">{longDate(selected)}</p>
            {!monthEvents ? (
              <p className="mt-2 text-sm text-muted">Loading…</p>
            ) : dayEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing on this day.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {dayEvents.map((e, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[e.kind])} />
                    <span className="min-w-0">
                      {e.href ? <Link href={e.href} className="text-accent hover:underline">{e.title}</Link> : e.title}
                      {e.detail && <span className="block text-xs text-muted">{e.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Pick a day to see what&apos;s on.</p>
        )}
      </div>
    </section>
  );
}
