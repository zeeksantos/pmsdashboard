export const resourceLabels: Record<string, string> = {
  employees: "Employee",
  employee_biodata: "Biodata",
  employee_documents: "Document",
  employee_salaries: "Salary",
  work_schedules: "Schedule",
  attendance_logs: "Attendance",
  user_roles: "User role",
  positions: "Position",
  departments: "Department",
  leave_types: "Leave type",
  leave_allocations: "Leave allowance",
  leave_requests: "Leave request",
  payroll_runs: "Payroll run",
  payslips: "Payslip",
  payslip_lines: "Payslip line",
  logins: "Login",
  company_events: "Company event",
};

export type AuditRow = {
  id: number;
  at: string;
  user_id: string | null;
  role: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  resource: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
};

type Json = Record<string, unknown>;

// Columns that change on every save and would only add noise.
const noisy = new Set(["updated_at", "created_at"]);

export type Change = { field: string; from: string; to: string };

export function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

// The record as it stood after the change (or before, for deletes).
export function snapshot(row: AuditRow): Json {
  const d = (row.details ?? {}) as Json;
  if (row.action === "UPDATE") return (d.new as Json) ?? {};
  return d;
}

export function changes(row: AuditRow): Change[] {
  if (row.action !== "UPDATE") return [];
  const d = (row.details ?? {}) as { old?: Json; new?: Json };
  const before = d.old ?? {};
  const after = d.new ?? {};
  return Object.keys(after)
    .filter((k) => !noisy.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((field) => ({ field, from: show(before[field]), to: show(after[field]) }));
}

// A human-readable name for the record, when the row carries one.
export function recordName(row: AuditRow): string | null {
  const s = snapshot(row);
  const name = s.full_name ?? s.title ?? s.name ?? s.employee_no ?? s.doc_type;
  return name ? String(name) : null;
}
