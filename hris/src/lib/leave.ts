export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const leaveStatusColor: Record<LeaveStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-danger/15 text-danger",
  CANCELLED: "bg-muted/15 text-muted",
};

export type LeaveBalance = {
  leave_type_id: string;
  name: string;
  has_balance: boolean;
  is_paid: boolean;
  allowance: number;
  used: number;
  pending: number;
  remaining: number;
};

// "Oct 5" or "Oct 5 – Oct 7"
export function formatRange(start: string, end: string): string {
  const f = (d: string) =>
    new Date(`${d}T00:00:00+08:00`).toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
    });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

export function formatDays(n: number | string): string {
  const v = Number(n);
  return `${v} day${v === 1 ? "" : "s"}`;
}
