export type Role = "employee" | "manager" | "hr" | "finance" | "admin" | "owner";

export const roleLabels: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  finance: "Finance",
  admin: "Admin",
  owner: "Owner",
};

// Who may see everyone's attendance (matches the att_read RLS policy).
export const attendanceViewers: Role[] = ["manager", "hr", "admin", "owner"];

export function canViewTeamAttendance(role: Role) {
  return attendanceViewers.includes(role);
}
