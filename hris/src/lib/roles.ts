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

// Who may read the audit log (matches the audit_read RLS policy).
export const auditViewers: Role[] = ["admin", "owner"];
export function canViewAuditLog(role: Role) {
  return auditViewers.includes(role);
}

// Who may prepare and finalize payroll (matches the payroll RLS policies).
export const payrollStaff: Role[] = ["finance", "admin", "owner"];
export function canManagePayroll(role: Role) {
  return payrollStaff.includes(role);
}

// Who may create logins, change roles and reset passwords (matches the admin_* database functions).
export const userManagers: Role[] = ["admin", "owner"];
export function canManageUsers(role: Role) {
  return userManagers.includes(role);
}

// Who may create a login when adding an employee, and which access levels they may hand out.
// HR can give employee, manager or hr; finance (salary access), admin and owner stay with
// admin/owner (matches admin_create_user).
export function loginRolesFor(role: Role): Role[] {
  if (role === "owner") return allRoles;
  if (role === "admin") return allRoles.filter((r) => r !== "owner");
  if (role === "hr") return ["employee", "manager", "hr"];
  return [];
}
export function canCreateLogins(role: Role) {
  return loginRolesFor(role).length > 0;
}
