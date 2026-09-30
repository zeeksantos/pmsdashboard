import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canViewDirectory, canViewSalaries, canViewTeamAttendance, roleLabels } from "@/lib/roles";
import { Sidebar, type NavItem } from "./Sidebar";
import { signOut } from "../login/actions";

// Per-user pages: always render on request, never at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const nav: NavItem[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/time-clock", label: "Time Clock", icon: "clock" },
    { href: "/attendance", label: "My Attendance", icon: "calendar" },
  ];
  if (me.employee) {
    nav.push({ href: `/employees/${me.employee.id}`, label: "My Profile", icon: "user" });
  }
  if (canViewDirectory(me.role)) {
    nav.push({ href: "/employees", label: "Employees", icon: "users" });
    nav.push({ href: "/org-chart", label: "Org Chart", icon: "network" });
  }
  if (canViewSalaries(me.role)) {
    nav.push({ href: "/salaries", label: "Salaries", icon: "wallet" });
  }
  if (canViewTeamAttendance(me.role)) {
    nav.push({ href: "/team-attendance", label: "Team Attendance", icon: "clipboard" });
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        items={nav}
        name={me.employee?.full_name ?? me.email ?? "User"}
        roleLabel={roleLabels[me.role]}
        signOut={signOut}
      />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
