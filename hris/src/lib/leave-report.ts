// Leave pay summary for one payroll run. Pure: turns leave rows and payslips into report rows.
// Leave days come from approved leave as it stands now; the peso value of a day comes from the
// rates saved on each payslip, so it matches the pay that was calculated.

import { DEFAULT_UNPAID_BREAK_HOURS, round2 } from "./payroll.ts";

export type LeaveRow = { employee_id: string; leave_type: string; is_paid: boolean; days: number };

export type SlipForLeave = {
  employee_id: string;
  name: string;
  employee_no: string;
  snapshot: Record<string, unknown> | null;
};

export type LeaveEmployeeRow = {
  employee_id: string;
  name: string;
  employee_no: string;
  paidDays: number;
  unpaidDays: number;
  paidValue: number; // pay for paid leave days, already inside basic pay
  unpaidValue: number; // pay not given for unpaid leave days (0 when absences weren't deducted)
  types: { leave_type: string; is_paid: boolean; days: number }[];
};

export type LeaveSummary = {
  rows: LeaveEmployeeRow[];
  totals: { paidDays: number; paidValue: number; unpaidDays: number; unpaidValue: number };
  byType: { leave_type: string; is_paid: boolean; employees: number; days: number; value: number }[];
  mismatched: string[]; // employees whose paid leave now differs from what their payslip used
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// Pay for one day, from the payslip's saved rates (monthly: daily rate; hourly: paid hours x rate).
export function dailyValue(snapshot: Record<string, unknown> | null): number {
  const s = snapshot ?? {};
  if (num(s.daily_rate) > 0) return num(s.daily_rate);
  const hours = Math.max(0, (num(s.shift_hours) || 8) - DEFAULT_UNPAID_BREAK_HOURS);
  return round2(num(s.hourly_rate) * hours);
}

export function leaveSummary(slips: SlipForLeave[], leave: LeaveRow[], deductAbsences: boolean): LeaveSummary {
  const bySlip = new Map(slips.map((s) => [s.employee_id, s]));
  const per = new Map<string, LeaveEmployeeRow>();
  const typeAgg = new Map<string, { leave_type: string; is_paid: boolean; employees: Set<string>; days: number; value: number }>();

  for (const l of leave) {
    const slip = bySlip.get(l.employee_id);
    if (!slip || !(l.days > 0)) continue;
    const day = dailyValue(slip.snapshot);
    const monthly = num((slip.snapshot ?? {}).daily_rate) > 0;
    // Unpaid leave costs the employee pay only when absences are deducted (monthly) or always (hourly).
    const value = l.is_paid ? round2(l.days * day) : monthly && !deductAbsences ? 0 : round2(l.days * day);

    let row = per.get(l.employee_id);
    if (!row) {
      row = { employee_id: l.employee_id, name: slip.name, employee_no: slip.employee_no, paidDays: 0, unpaidDays: 0, paidValue: 0, unpaidValue: 0, types: [] };
      per.set(l.employee_id, row);
    }
    if (l.is_paid) { row.paidDays += l.days; row.paidValue = round2(row.paidValue + value); }
    else { row.unpaidDays += l.days; row.unpaidValue = round2(row.unpaidValue + value); }
    row.types.push({ leave_type: l.leave_type, is_paid: l.is_paid, days: l.days });

    const key = `${l.is_paid ? "1" : "0"}|${l.leave_type}`;
    const agg = typeAgg.get(key) ?? { leave_type: l.leave_type, is_paid: l.is_paid, employees: new Set<string>(), days: 0, value: 0 };
    agg.employees.add(l.employee_id);
    agg.days += l.days;
    agg.value = round2(agg.value + value);
    typeAgg.set(key, agg);
  }

  const rows = [...per.values()].sort((a, b) => b.paidDays + b.unpaidDays - (a.paidDays + a.unpaidDays) || a.name.localeCompare(b.name));
  const totals = rows.reduce(
    (t, r) => ({
      paidDays: t.paidDays + r.paidDays, paidValue: round2(t.paidValue + r.paidValue),
      unpaidDays: t.unpaidDays + r.unpaidDays, unpaidValue: round2(t.unpaidValue + r.unpaidValue),
    }),
    { paidDays: 0, paidValue: 0, unpaidDays: 0, unpaidValue: 0 }
  );
  const byType = [...typeAgg.values()]
    .map((a) => ({ leave_type: a.leave_type, is_paid: a.is_paid, employees: a.employees.size, days: a.days, value: a.value }))
    .sort((a, b) => Number(b.is_paid) - Number(a.is_paid) || a.leave_type.localeCompare(b.leave_type));

  // The payslip saved how many paid leave days it used; flag anyone whose leave changed since.
  const mismatched = slips
    .filter((s) => Math.abs((per.get(s.employee_id)?.paidDays ?? 0) - num((s.snapshot ?? {}).paid_leave_days)) > 0.001)
    .map((s) => s.name)
    .sort();

  return { rows, totals, byType, mismatched };
}
