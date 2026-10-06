import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/session";
import { canManageRecords, canViewDirectory, canViewTeamAttendance } from "@/lib/roles";
import { expandRange, monthOf, yearlyDate, type CalendarEvent } from "@/lib/calendar";
import { formatTime } from "@/lib/format";
import { companyKindLabels, type CompanyEventKind } from "@/lib/company-events";

type LeaveRow = { employee_id?: string; start_date: string; end_date: string; status: string; half_day: boolean; leave_types: { name: string } | null };

// Everything that happens in one month, limited to what this person is allowed to see. The
// database security rules decide what each query returns; the checks here only skip queries
// that would come back empty anyway.
export async function loadCalendarEvents(me: CurrentUser, year: number, month: number): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { first, last } = monthOf(`${year}-${String(month).padStart(2, "0")}-01`);
  const team = canViewTeamAttendance(me.role);
  const directory = canViewDirectory(me.role);
  const hr = canManageRecords(me.role);
  const empId = me.employee?.id;
  const events: CalendarEvent[] = [];

  const [myLeave, teamLeave, myLogs, people, bios, company] = await Promise.all([
    empId
      ? supabase.from("leave_requests").select("start_date, end_date, status, half_day, leave_types(name)")
          .eq("employee_id", empId).in("status", ["APPROVED", "PENDING"]).lte("start_date", last).gte("end_date", first)
      : Promise.resolve({ data: null }),
    team
      ? supabase.from("leave_requests").select("employee_id, start_date, end_date, status, half_day, leave_types(name)")
          .eq("status", "APPROVED").lte("start_date", last).gte("end_date", first)
      : Promise.resolve({ data: null }),
    empId
      ? supabase.from("attendance_logs").select("work_date, time_in, time_out, late_minutes, work_mode, field_note")
          .eq("employee_id", empId).gte("work_date", first).lte("work_date", last)
      : Promise.resolve({ data: null }),
    directory
      ? supabase.from("employees").select("id, full_name, date_hired, contract_end_date, regularization_date, status")
          .in("status", ["ACTIVE", "ON_LEAVE"])
      : Promise.resolve({ data: null }),
    hr ? supabase.from("employee_biodata").select("employee_id, date_of_birth") : Promise.resolve({ data: null }),
    supabase.from("company_events").select("title, kind, start_date, end_date, note").lte("start_date", last).gte("end_date", first),
  ]);

  const names = new Map<string, string>(
    ((people.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])
  );

  for (const r of (myLeave.data ?? []) as unknown as LeaveRow[]) {
    const label = r.leave_types?.name ?? "Leave";
    for (const date of expandRange(r.start_date, r.end_date)) {
      if (date < first || date > last) continue;
      events.push({
        date,
        kind: r.status === "APPROVED" ? "leave" : "leave-pending",
        title: `${label}${r.half_day ? " (half day)" : ""}`,
        detail: r.status === "APPROVED" ? "Your leave, approved" : "Your leave, waiting for approval",
        href: "/leave",
      });
    }
  }

  for (const r of (teamLeave.data ?? []) as unknown as LeaveRow[]) {
    if (r.employee_id === empId) continue; // your own leave is already listed above
    for (const date of expandRange(r.start_date, r.end_date)) {
      if (date < first || date > last) continue;
      events.push({
        date,
        kind: "team-leave",
        title: `${names.get(r.employee_id ?? "") ?? "A teammate"} is on leave`,
        detail: r.leave_types?.name,
        href: r.employee_id ? `/employees/${r.employee_id}` : undefined,
      });
    }
  }

  for (const l of (myLogs.data ?? []) as { work_date: string; time_in: string | null; time_out: string | null; late_minutes: number; work_mode: string; field_note: string | null }[]) {
    events.push({
      date: l.work_date,
      kind: "attendance",
      title: `In ${formatTime(l.time_in)} · Out ${formatTime(l.time_out)}`,
      detail: [l.work_mode === "FIELD" ? `Field: ${l.field_note ?? "out of office"}` : null, l.late_minutes > 0 ? `Late ${l.late_minutes} min` : null].filter(Boolean).join(" · ") || undefined,
      href: "/attendance",
    });
  }

  for (const p of (people.data ?? []) as { id: string; full_name: string; date_hired: string; contract_end_date: string | null; regularization_date: string | null }[]) {
    const anniv = yearlyDate(p.date_hired, year, month);
    const years = year - Number(p.date_hired.slice(0, 4));
    if (anniv && years > 0) {
      events.push({ date: anniv, kind: "anniversary", title: `${p.full_name}: ${years}-year work anniversary`, href: `/employees/${p.id}` });
    }
    if (p.contract_end_date && p.contract_end_date >= first && p.contract_end_date <= last) {
      events.push({ date: p.contract_end_date, kind: "contract", title: `${p.full_name}: contract ends`, href: `/employees/${p.id}` });
    }
    if (p.regularization_date && p.regularization_date >= first && p.regularization_date <= last) {
      events.push({ date: p.regularization_date, kind: "regularization", title: `${p.full_name}: regularization due`, href: `/employees/${p.id}` });
    }
  }

  for (const b of (bios.data ?? []) as { employee_id: string; date_of_birth: string | null }[]) {
    if (!b.date_of_birth) continue;
    const date = yearlyDate(b.date_of_birth, year, month);
    const name = names.get(b.employee_id);
    if (date && name) events.push({ date, kind: "birthday", title: `${name}'s birthday`, href: `/employees/${b.employee_id}` });
  }

  for (const c of (company.data ?? []) as { title: string; kind: CompanyEventKind; start_date: string; end_date: string; note: string | null }[]) {
    for (const date of expandRange(c.start_date, c.end_date)) {
      if (date < first || date > last) continue;
      events.push({
        date,
        kind: c.kind === "REGULAR_HOLIDAY" ? "holiday-regular" : c.kind === "SPECIAL_HOLIDAY" ? "holiday-special" : "company-event",
        title: c.title,
        detail: [companyKindLabels[c.kind], c.note].filter(Boolean).join(" · "),
        href: "/company-calendar",
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}
