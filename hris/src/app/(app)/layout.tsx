import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll, canManageUsers, canViewAuditLog, canViewDirectory, canViewSalaries, canViewTeamAttendance, roleLabels } from "@/lib/roles";
import { AppShell } from "@/components/AppShell";
import { simplifyGroups, type NavGroup, type NavLink } from "@/lib/nav";
import { signOut } from "../login/actions";

// Per-user pages: always render on request, never at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const time: NavLink[] = [
    { href: "/time-clock", label: "Time Clock" },
    { href: "/attendance", label: "My Attendance" },
  ];
  if (canViewTeamAttendance(me.role)) time.push({ href: "/team-attendance", label: "Team Attendance" });

  const leave: NavLink[] = [];
  if (me.employee) leave.push({ href: "/leave", label: "My Leave" });
  if (canViewTeamAttendance(me.role)) leave.push({ href: "/leave/approvals", label: "Leave Approvals" });

  const people: NavLink[] = [];
  if (me.employee) people.push({ href: `/employees/${me.employee.id}`, label: "My Profile" });
  if (canViewDirectory(me.role)) {
    people.push({ href: "/employees", label: "Employees" });
    people.push({ href: "/org-chart", label: "Org Chart" });
  }
  if (canManageUsers(me.role)) people.push({ href: "/users", label: "Users" });

  const pay: NavLink[] = [];
  if (me.employee) pay.push({ href: "/payslips", label: "My Payslips" });
  if (canViewSalaries(me.role)) pay.push({ href: "/salaries", label: "Salaries" });
  if (canManagePayroll(me.role)) pay.push({ href: "/payroll", label: "Payroll" });

  const groups: NavGroup[] = [
    { label: "Dashboard", icon: "dashboard", href: "/" },
    { label: "Time & Attendance", icon: "clock", items: time },
    { label: "Leave", icon: "plane", items: leave },
    { label: "People", icon: "users", items: people },
    { label: "Payroll", icon: "banknote", items: pay },
  ];
  if (canViewAuditLog(me.role)) groups.push({ label: "Audit Log", icon: "shield", href: "/audit-log" });

  return (
    <AppShell
      groups={simplifyGroups(groups)}
      name={me.employee?.full_name ?? me.email ?? "User"}
      roleLabel={roleLabels[me.role]}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
