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

// Who may create/edit employee records and see biodata + government IDs.
export const recordManagers: Role[] = ["hr", "admin", "owner"];
export function canManageRecords(role: Role) {
  return recordManagers.includes(role);
}

// Who may open the employee directory (work info only; biodata stays restricted by RLS).
export const directoryViewers: Role[] = ["manager", "hr", "finance", "admin", "owner"];
export function canViewDirectory(role: Role) {
  return directoryViewers.includes(role);
}

export const allRoles: Role[] = ["employee", "manager", "hr", "finance", "admin", "owner"];

// Who may see and edit salary data (matches the employee_salaries RLS policy).
export const salaryViewers: Role[] = ["finance", "admin", "owner"];
export function canViewSalaries(role: Role) {
  return salaryViewers.includes(role);
}
