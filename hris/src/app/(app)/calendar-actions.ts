"use server";

import { getCurrentUser } from "@/lib/session";
import { loadCalendarEvents } from "@/lib/calendar-data";
import type { CalendarEvent } from "@/lib/calendar";

export async function loadMonthEvents(year: number, month: number): Promise<CalendarEvent[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) return [];
  return loadCalendarEvents(me, year, month);
}
