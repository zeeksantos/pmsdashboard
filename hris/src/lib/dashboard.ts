import { dayOfWeek, daysBetween, timeToMinutes } from "./dates";

export const GRACE_MINUTES = 15;

export type Schedule = {
  employee_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_to: string | null;
};

// The schedule in force today for each employee (latest effective_from wins).
export function activeSchedules(rows: Schedule[], today: string): Map<string, Schedule> {
  const out = new Map<string, Schedule>();
  for (const s of rows) {
    if (s.effective_from > today || (s.effective_to && s.effective_to < today)) continue;
    const prev = out.get(s.employee_id);
    if (!prev || s.effective_from > prev.effective_from) out.set(s.employee_id, s);
  }
  return out;
}

export type TodayLog = { employee_id: string; time_in: string | null; late_minutes: number };

export type TeamToday = {
  scheduled: string[]; // employee ids working today
  clockedIn: string[];
  late: string[];
  notIn: string[]; // scheduled, past start + grace, no time-in
  notYetDue: string[]; // scheduled, no time-in, still within start + grace
};

export function teamToday(
  activeIds: string[],
  schedules: Map<string, Schedule>,
  logs: TodayLog[],
  today: string,
  nowMinutes: number
): TeamToday {
  const dow = dayOfWeek(today);
  const logByEmp = new Map(logs.map((l) => [l.employee_id, l]));
  const result: TeamToday = { scheduled: [], clockedIn: [], late: [], notIn: [], notYetDue: [] };

  for (const id of activeIds) {
    const log = logByEmp.get(id);
    const sched = schedules.get(id);
    const works = Boolean(sched && sched.days_of_week.includes(dow));
    if (works) result.scheduled.push(id);
    // Someone who clocked in counts as present even on a non-scheduled day.
    if (log?.time_in) {
      result.clockedIn.push(id);
      if (log.late_minutes > 0) result.late.push(id);
    } else if (works && sched) {
      if (nowMinutes > timeToMinutes(sched.start_time) + GRACE_MINUTES) result.notIn.push(id);
      else result.notYetDue.push(id);
    }
  }
  return result;
}

// Days from today until `date` (negative = already passed).
export function daysUntil(today: string, date: string): number {
  return daysBetween(today, date);
}

export function birthdaysThisMonth(
  people: { id: string; date_of_birth: string | null }[],
  today: string
): { id: string; day: number }[] {
  const month = today.slice(5, 7);
  return people
    .filter((p) => p.date_of_birth && p.date_of_birth.slice(5, 7) === month)
    .map((p) => ({ id: p.id, day: Number(p.date_of_birth!.slice(8, 10)) }))
    .sort((a, b) => a.day - b.day);
}
