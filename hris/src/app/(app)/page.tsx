import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import {
  canManagePayroll,
  canManageRecords,
  canViewDirectory,
  canViewSalaries,
  canViewTeamAttendance,
  roleLabels,
} from "@/lib/roles";
import { formatDate, formatTime, manilaToday } from "@/lib/format";
import { endDatedTypes, employmentTypes, label } from "@/lib/employees";
import { manilaMinutesNow } from "@/lib/dates";
import { currentSalary, type Salary } from "@/lib/salary";
import {
  activeSchedules,
  birthdaysThisMonth,
  daysUntil,
  teamToday,
  type Schedule,
} from "@/lib/dashboard";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";
import { CalendarPanel } from "@/components/CalendarPanel";
import { loadCalendarEvents } from "@/lib/calendar-data";
import { monthOf } from "@/lib/calendar";
import { Banknote, Clock, Plane, Receipt, User, Users, ClipboardList, type LucideIcon } from "lucide-react";

type Emp = {
  id: string;
  full_name: string;
  employment_type: string;
  status: string;
  user_id: string | null;
  regularization_date: string | null;
  contract_end_date: string | null;
  departments: { name: string } | null;
};

const WINDOW_DAYS = 30;

function Stat({
  name, value, href, tone,
}: { name: string; value: number | string; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent">
      <p className="text-xs text-muted">{name}</p>
      <p className={cn("mt-1 text-2xl font-semibold", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Panel({ title, empty, items, note }: {
  title: string;
  empty: string;
  items: { id: string; name: string; detail?: string; tone?: "warning" | "danger" }[];
  note?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      {items.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <Link href={`/employees/${i.id}`} className="text-accent hover:underline">{i.name}</Link>
              {i.detail && <span className={cn("text-xs", i.tone === "danger" ? "text-danger" : i.tone === "warning" ? "text-warning" : "text-muted")}>{i.detail}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

function QuickTile({ href, label, hint, Icon, color }: {
  href: string; label: string; hint: string; Icon: LucideIcon; color: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 rounded-2xl p-4 text-white shadow-sm transition-transform hover:-translate-y-0.5", color)}>
      <Icon size={26} aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-white/85">{hint}</span>
      </span>
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-8 text-lg font-semibold">{children}</h2>;
}

export default async function HomePage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = await createClient();
  const today = manilaToday();
  const showDirectory = canViewDirectory(me.role);
  const showTeam = canViewTeamAttendance(me.role);
  const showHr = canManageRecords(me.role);
  const showSalary = canViewSalaries(me.role);

  const month = monthOf(today);
  const [myLog, profileRes, myBioRes, calendarEvents, employeesRes, schedulesRes, logsRes, bioRes, salariesRes, leaveRes, pendingLeaveRes] = await Promise.all([
    me.employee
      ? supabase.from("attendance_logs").select("time_in, time_out, late_minutes")
          .eq("employee_id", me.employee.id).eq("work_date", today).maybeSingle()
      : Promise.resolve({ data: null }),
    me.employee
      ? supabase.from("employees")
          .select("employee_no, date_hired, departments(name), positions(title)")
          .eq("id", me.employee.id).maybeSingle()
      : Promise.resolve({ data: null }),
    me.employee
      ? supabase.from("employee_biodata").select("phone").eq("employee_id", me.employee.id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadCalendarEvents(me, month.year, month.month),
    showDirectory
      ? supabase.from("employees")
          .select("id, full_name, employment_type, status, user_id, regularization_date, contract_end_date, departments(name)")
          .order("full_name")
      : Promise.resolve({ data: null }),
    showTeam || showHr
      ? supabase.from("work_schedules").select("employee_id, days_of_week, start_time, end_time, effective_from, effective_to")
      : Promise.resolve({ data: null }),
    showTeam
      ? supabase.from("attendance_logs").select("employee_id, time_in, late_minutes").eq("work_date", today)
      : Promise.resolve({ data: null }),
    showHr
      ? supabase.from("employee_biodata").select("employee_id, date_of_birth")
      : Promise.resolve({ data: null }),
    showSalary
      ? supabase.from("employee_salaries").select("employee_id, monthly_rate, hourly_rate, effective_from")
      : Promise.resolve({ data: null }),
    showTeam ? supabase.rpc("employees_on_leave", { p_date: today }) : Promise.resolve({ data: null }),
    showTeam
      ? (() => {
          // Same rule as the Leave Approvals page: your own requests aren't in your queue.
          const q = supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING");
          return me.employee ? q.neq("employee_id", me.employee.id) : q;
        })()
      : Promise.resolve({ count: null }),
  ]);

  const employees = (employeesRes.data ?? []) as unknown as Emp[];
  const byId = new Map(employees.map((e) => [e.id, e]));
  const name = (id: string) => byId.get(id)?.full_name ?? "Unknown";
  const active = employees.filter((e) => e.status === "ACTIVE");
  const onLeave = employees.filter((e) => e.status === "ON_LEAVE").length;

  const schedules = activeSchedules((schedulesRes.data ?? []) as Schedule[], today);
  const team = teamToday(
    active.map((e) => e.id),
    schedules,
    (logsRes.data ?? []) as { employee_id: string; time_in: string | null; late_minutes: number }[],
    today,
    manilaMinutesNow(),
    new Set((leaveRes.data ?? []) as string[])
  );
  const pendingLeave = pendingLeaveRes.count ?? 0;

  // Headcount breakdowns
  const byType = employmentTypes.map((t) => ({
    type: t, count: active.filter((e) => e.employment_type === t).length,
  }));
  const deptCounts = new Map<string, number>();
  for (const e of active) {
    const d = e.departments?.name ?? "No department";
    deptCounts.set(d, (deptCounts.get(d) ?? 0) + 1);
  }

  // HR attention lists
  const contractsEnding = active
    .filter((e) => endDatedTypes.includes(e.employment_type) && e.contract_end_date && daysUntil(today, e.contract_end_date) <= WINDOW_DAYS)
    .sort((a, b) => a.contract_end_date!.localeCompare(b.contract_end_date!))
    .map((e) => {
      const d = daysUntil(today, e.contract_end_date!);
      return { id: e.id, name: e.full_name, detail: d < 0 ? `ended ${-d}d ago` : d === 0 ? "ends today" : `in ${d}d`, tone: d < 0 ? ("danger" as const) : ("warning" as const) };
    });
  const regularizations = active
    .filter((e) => e.employment_type !== "REGULAR" && e.regularization_date && daysUntil(today, e.regularization_date) <= WINDOW_DAYS)
    .sort((a, b) => a.regularization_date!.localeCompare(b.regularization_date!))
    .map((e) => {
      const d = daysUntil(today, e.regularization_date!);
      return { id: e.id, name: e.full_name, detail: d < 0 ? `due ${-d}d ago` : d === 0 ? "due today" : `in ${d}d`, tone: d < 0 ? ("danger" as const) : ("warning" as const) };
    });
  const bioIds = new Set((bioRes.data ?? []).map((b: { employee_id: string }) => b.employee_id));
  const noBiodata = active.filter((e) => !bioIds.has(e.id));
  const noLogin = active.filter((e) => !e.user_id);
  const noSchedule = active.filter((e) => !schedules.has(e.id));
  const birthdays = birthdaysThisMonth(
    ((bioRes.data ?? []) as { employee_id: string; date_of_birth: string | null }[]).map((b) => ({
      id: b.employee_id,
      date_of_birth: b.date_of_birth,
    })),
    today
  );

  const salariesByEmp = new Map<string, (Salary & { employee_id: string })[]>();
  for (const s of (salariesRes.data ?? []) as (Salary & { employee_id: string })[]) {
    salariesByEmp.set(s.employee_id, [...(salariesByEmp.get(s.employee_id) ?? []), s]);
  }
  const noSalary = active.filter((e) => !currentSalary(salariesByEmp.get(e.id) ?? [], today)).length;

  const tile = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

  const profile = profileRes.data as unknown as {
    employee_no: string; date_hired: string | null; positions: { title: string } | null; departments: { name: string } | null;
  } | null;
  const displayName = me.employee?.full_name ?? me.email ?? "User";
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "—";

  // Shortcuts: the most useful four for this role.
  const shortcuts: { href: string; label: string; hint: string; Icon: LucideIcon }[] = [];
  if (me.employee) shortcuts.push({ href: "/time-clock", label: "Time Clock", hint: "Time in / out", Icon: Clock });
  if (me.employee) shortcuts.push({ href: "/leave", label: "Leave", hint: "File or track leave", Icon: Plane });
  if (me.employee) shortcuts.push({ href: "/payslips", label: "Payslips", hint: "View your pay", Icon: Receipt });
  if (showDirectory) shortcuts.push({ href: "/employees", label: "Employees", hint: "Directory", Icon: Users });
  if (canManagePayroll(me.role)) shortcuts.push({ href: "/payroll", label: "Payroll", hint: "Pay runs", Icon: Banknote });
  if (showTeam) shortcuts.push({ href: "/team-attendance", label: "Team Attendance", hint: "Who is in today", Icon: ClipboardList });
  if (me.employee) shortcuts.push({ href: `/employees/${me.employee.id}`, label: "My Profile", hint: "Your records", Icon: User });
  const tileColors = ["tile-red", "tile-orange", "tile-amber", "tile-crimson"];

  return (
    <div className="max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Hello, {displayName}</h1>
            <p className="mt-1 text-sm text-muted">{formatDate(today)}</p>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{me.employee ? "My Information" : "Account"}</h2>
              <Link href="/settings" className="text-xs text-accent hover:underline">Edit info</Link>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Avatar name={displayName} className="h-16 w-16 text-xl" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{displayName}</p>
                <p className="text-sm text-muted">{roleLabels[me.role]}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile && <Fact label="Employee no." value={profile.employee_no} />}
              {profile && <Fact label="Department" value={profile.departments?.name ?? "—"} />}
              {profile && <Fact label="Position" value={profile.positions?.title ?? "—"} />}
              <Fact label="Email" value={me.email ?? "—"} />
              {profile && <Fact label="Phone" value={(myBioRes.data as { phone: string | null } | null)?.phone || "—"} />}
              {profile?.date_hired && <Fact label="Member since" value={formatDate(profile.date_hired)} />}
              <Fact label="Last login" value={when(me.lastSignInAt)} />
            </dl>
          </section>

          {shortcuts.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {shortcuts.slice(0, 4).map((t, i) => (
                <QuickTile key={t.href} {...t} color={tileColors[i]} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {!me.employee ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Your login isn&apos;t linked to an employee record yet, so you can&apos;t time in. Ask an admin or HR to link it.
            </div>
          ) : (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">My day</h3>
              <p className="mt-2 text-sm">
                In <span className="font-medium">{formatTime(myLog.data?.time_in ?? null)}</span> · Out{" "}
                <span className="font-medium">{formatTime(myLog.data?.time_out ?? null)}</span>
              </p>
              {myLog.data && myLog.data.late_minutes > 0 && (
                <p className="mt-1 text-xs text-warning">Late {myLog.data.late_minutes} min</p>
              )}
              <Link href="/time-clock" className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90">
                Time Clock
              </Link>
            </section>
          )}
          <CalendarPanel year={month.year} month={month.month} today={today} events={calendarEvents} canAdd={showHr} />
        </aside>
      </div>

      {showTeam && (
        <>
          <Heading>Today&apos;s attendance</Heading>
          <div className={tile}>
            <Stat name="Scheduled today" value={team.scheduled.length} href="/team-attendance" />
            <Stat name="Clocked in" value={team.clockedIn.length} href="/team-attendance" />
            <Stat name="Late" value={team.late.length} href="/team-attendance" tone={team.late.length ? "warning" : undefined} />
            <Stat name="Not in yet (past grace)" value={team.notIn.length} href="/team-attendance" tone={team.notIn.length ? "danger" : undefined} />
            <Stat name="On approved leave" value={team.onLeave.length} href="/leave/approvals" />
            <Stat name="Leave requests waiting" value={pendingLeave} href="/leave/approvals" tone={pendingLeave ? "warning" : undefined} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Panel
              title="Late today"
              empty="No one is late."
              items={team.late.map((id) => ({ id, name: name(id), detail: "late" }))}
            />
            <Panel
              title="On approved leave today"
              empty="No one is on leave."
              items={team.onLeave.map((id) => ({ id, name: name(id) }))}
            />
            <Panel
              title="Not in yet"
              note="Scheduled today, past the 15-minute grace, no time-in, and not on approved leave."
              empty="Everyone scheduled has clocked in or isn't due yet."
              items={team.notIn.map((id) => ({ id, name: name(id), tone: "danger" as const, detail: `starts ${schedules.get(id)?.start_time.slice(0, 5)}` }))}
            />
          </div>
        </>
      )}

      {showDirectory && (
        <>
          <Heading>Headcount</Heading>
          <div className={tile}>
            <Stat name="Active employees" value={active.length} href="/employees?status=ACTIVE" />
            {byType.map((t) => (
              <Stat key={t.type} name={label(t.type)} value={t.count} href={`/employees?status=ACTIVE&type=${t.type}`} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">By department</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {[...deptCounts.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => (
                  <li key={d} className="flex justify-between"><span>{d}</span><span className="text-muted">{n}</span></li>
                ))}
                {!deptCounts.size && <li className="text-muted">No active employees.</li>}
              </ul>
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">Other</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex justify-between">
                  <Link href="/employees?status=ON_LEAVE" className="text-accent hover:underline">On leave (status)</Link>
                  <span className="text-muted">{onLeave}</span>
                </li>
              </ul>
            </section>
          </div>
        </>
      )}

      {showHr && (
        <>
          <Heading>Needs attention</Heading>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={`Contracts and projects ending (next ${WINDOW_DAYS} days)`} empty="No contracts ending soon." items={contractsEnding} />
            <Panel title={`Regularization due (next ${WINDOW_DAYS} days)`} note="Non-regular staff with a regularization date." empty="Nothing due." items={regularizations} />
            <Panel title="Active with no biodata" empty="All active employees have biodata." items={noBiodata.map((e) => ({ id: e.id, name: e.full_name }))} />
            <Panel title="Active with no schedule" note="They can time in, but lateness can't be calculated." empty="Everyone has a schedule." items={noSchedule.map((e) => ({ id: e.id, name: e.full_name }))} />
            <Panel title="Active with no login linked" empty="Everyone has a login." items={noLogin.map((e) => ({ id: e.id, name: e.full_name }))} />
            <Panel
              title="Birthdays this month"
              empty="No birthdays this month."
              items={birthdays.filter((b) => byId.get(b.id)?.status === "ACTIVE").map((b) => ({ id: b.id, name: name(b.id), detail: `${b.day}` }))}
            />
          </div>
        </>
      )}

      {showSalary && (
        <>
          <Heading>Payroll readiness</Heading>
          <div className={tile}>
            <Stat name="Active with no salary set" value={noSalary} href="/salaries" tone={noSalary ? "warning" : undefined} />
          </div>
        </>
      )}
    </div>
  );
}
