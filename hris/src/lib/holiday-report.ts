// Holiday pay summary for one payroll run. Pure: turns payslips into report rows and totals.
// Day counts come from each payslip's snapshot; peso amounts come from its holiday lines, so the
// report always matches what is on the payslips (including any manual change to those lines).

import { round2 } from "./payroll.ts";

export const HOLIDAY_CODES = ["HOLIDAY_REG", "HOLIDAY_SPECIAL", "HOLIDAY_REG_REST", "HOLIDAY_SPECIAL_REST"] as const;
export type HolidayCode = (typeof HOLIDAY_CODES)[number];

export const holidayCodeLabels: Record<HolidayCode, string> = {
  HOLIDAY_REG: "Regular holiday worked (+100%, 200% in all)",
  HOLIDAY_SPECIAL: "Special non-working day worked (+30%, 130% in all)",
  HOLIDAY_REG_REST: "Regular holiday worked on the rest day (260%)",
  HOLIDAY_SPECIAL_REST: "Special non-working day worked on the rest day (150%)",
};

export type SlipForReport = {
  employee_id: string;
  name: string;
  employee_no: string;
  snapshot: Record<string, unknown> | null;
  lines: { code: string; amount: number }[];
};

export type HolidayRow = {
  employee_id: string;
  name: string;
  employee_no: string;
  days: Record<HolidayCode, number>;
  paidUnworked: number; // unworked regular holidays that were paid (already inside basic pay)
  amounts: Record<HolidayCode, number>;
  total: number; // holiday premium pay in pesos
};

export type HolidaySummary = {
  included: boolean; // false when the run was made without the Holiday pay option
  rows: HolidayRow[];
  totals: { days: Record<HolidayCode, number>; amounts: Record<HolidayCode, number>; paidUnworked: number; total: number };
};

const zero = (): Record<HolidayCode, number> => ({ HOLIDAY_REG: 0, HOLIDAY_SPECIAL: 0, HOLIDAY_REG_REST: 0, HOLIDAY_SPECIAL_REST: 0 });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function holidaySummary(slips: SlipForReport[], runHadHolidayPay: boolean): HolidaySummary {
  const totals = { days: zero(), amounts: zero(), paidUnworked: 0, total: 0 };
  const rows: HolidayRow[] = [];

  for (const s of slips) {
    const snap = s.snapshot ?? {};
    const days: Record<HolidayCode, number> = {
      HOLIDAY_REG: num(snap.reg_holiday_worked),
      HOLIDAY_SPECIAL: num(snap.spec_holiday_worked),
      HOLIDAY_REG_REST: num(snap.reg_rest_holiday_worked),
      HOLIDAY_SPECIAL_REST: num(snap.spec_rest_holiday_worked),
    };
    const paidUnworked = num(snap.reg_holiday_paid_unworked);
    const amounts = zero();
    for (const l of s.lines) {
      if ((HOLIDAY_CODES as readonly string[]).includes(l.code)) amounts[l.code as HolidayCode] += Number(l.amount);
    }
    const total = round2(HOLIDAY_CODES.reduce((t, c) => t + amounts[c], 0));
    const active = total > 0 || paidUnworked > 0 || HOLIDAY_CODES.some((c) => days[c] > 0);
    if (!active) continue;

    rows.push({ employee_id: s.employee_id, name: s.name, employee_no: s.employee_no, days, paidUnworked, amounts, total });
    for (const c of HOLIDAY_CODES) {
      totals.days[c] += days[c];
      totals.amounts[c] = round2(totals.amounts[c] + amounts[c]);
    }
    totals.paidUnworked += paidUnworked;
    totals.total = round2(totals.total + total);
  }

  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { included: runHadHolidayPay, rows, totals };
}
