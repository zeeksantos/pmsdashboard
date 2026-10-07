// Payroll calculations. Pure functions: no database, no dates, easy to test.
//
// Government rates below are BUILT IN and change from time to time. Each payroll run stores
// RATES_VERSION so you can tell which schedule produced it. Have your accountant confirm them
// against the current SSS, PhilHealth, Pag-IBIG and BIR circulars before relying on payslips.

export const RATES_VERSION =
  "SSS 2025 (5% employee, MSC 5,000-35,000) · PhilHealth 5% (floor 10,000, cap 100,000) · Pag-IBIG 2% (cap 10,000) · BIR TRAIN 2023 table · Holiday pay per DOLE rules (regular holiday 200% worked / 100% unworked, special non-working 130%, rest day 260% / 150%)";

const WEEKS_PER_YEAR = 52.2; // 5-day week => 261 paid days/year, 6-day => ~313

export type Money = number; // pesos, rounded to centavos at the edges

export const round2 = (n: number): Money => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// --- Government contributions (monthly amounts) --------------------------------------------

export function sss(monthly: Money): { employee: Money; employer: Money; msc: Money } {
  const msc = clamp(Math.round(monthly / 500) * 500, 5000, 35000);
  return { msc, employee: round2(msc * 0.05), employer: round2(msc * 0.1) };
}

export function philhealth(monthly: Money): { employee: Money; employer: Money } {
  const base = clamp(monthly, 10000, 100000);
  const total = round2(base * 0.05);
  return { employee: round2(total / 2), employer: round2(total / 2) };
}

export function pagibig(monthly: Money): { employee: Money; employer: Money } {
  const base = Math.min(monthly, 10000);
  const eeRate = monthly <= 1500 ? 0.01 : 0.02;
  const erRate = monthly <= 1500 ? 0.02 : 0.02;
  return { employee: round2(base * eeRate), employer: round2(base * erRate) };
}

// --- Withholding tax (TRAIN, annual brackets) ----------------------------------------------

const TAX_BRACKETS: { over: number; base: number; rate: number }[] = [
  { over: 8_000_000, base: 2_402_500, rate: 0.35 },
  { over: 2_000_000, base: 402_500, rate: 0.3 },
  { over: 800_000, base: 102_500, rate: 0.25 },
  { over: 400_000, base: 22_500, rate: 0.2 },
  { over: 250_000, base: 0, rate: 0.15 },
];

export function annualTax(annualTaxable: Money): Money {
  const b = TAX_BRACKETS.find((x) => annualTaxable > x.over);
  return b ? round2(b.base + (annualTaxable - b.over) * b.rate) : 0;
}

// Monthly withholding = annual tax on the annualized taxable pay, spread over 12 months.
export function monthlyWithholding(monthlyTaxable: Money): Money {
  return round2(annualTax(monthlyTaxable * 12) / 12);
}

// --- A payslip -----------------------------------------------------------------------------

export type RunOptions = {
  deduct_absences: boolean;
  deduct_late: boolean; // late + undertime
  gov_contributions: boolean;
  withhold_tax: boolean;
  holiday_pay?: boolean; // runs made before holiday pay existed leave this out (= off)
};

// Holiday pay (DOLE rules), as a multiple of the daily rate ON TOP of what basic pay already covers.
//  - Regular holiday worked on a working day: 200% in all, so +100% over basic.
//  - Special non-working day worked on a working day: 130% in all, so +30% over basic.
//  - Worked on the employee's rest day: not covered by basic, so the whole amount is added:
//    regular holiday 260%, special non-working day 150%.
//  - Regular holiday not worked: paid 100% if the employee was present (or on paid leave) on the
//    working day before. Special non-working day not worked: no work, no pay.
export const HOLIDAY_RATES = {
  regularWorked: 1.0,
  specialWorked: 0.3,
  regularRestWorked: 2.6,
  specialRestWorked: 1.5,
} as const;

export type PayInputs = {
  days_scheduled: number;
  days_present: number;
  paid_leave_days: number;
  absent_days: number;
  late_minutes: number;
  undertime_minutes: number;
  shift_hours: number;
  days_per_week: number;
  // Holiday counts for the period (leave out or 0 when there are none)
  reg_holiday_worked?: number; // regular holiday, working day, worked
  spec_holiday_worked?: number; // special non-working day, working day, worked
  reg_holiday_paid_unworked?: number; // regular holiday not worked but paid (counted in absent_days too)
  reg_rest_holiday_worked?: number; // regular holiday worked on the rest day
  spec_rest_holiday_worked?: number; // special non-working day worked on the rest day
};

export type Line = {
  kind: "EARNING" | "DEDUCTION" | "EMPLOYER";
  code: string;
  label: string;
  amount: Money;
};

export type PayslipResult = {
  lines: Line[];
  snapshot: Record<string, number | string>;
  gross: Money;
  deductions: Money;
  net: Money;
};

export const DEFAULT_UNPAID_BREAK_HOURS = 1;

export function computePayslip(args: {
  monthlyRate: number | null;
  hourlyRate: number | null;
  periodsPerMonth: 1 | 2;
  inputs: PayInputs;
  options: RunOptions;
  unpaidBreakHours?: number;
}): PayslipResult {
  const { monthlyRate, hourlyRate, periodsPerMonth, inputs: i, options } = args;
  const lines: Line[] = [];
  const add = (kind: Line["kind"], code: string, label: string, amount: Money) => {
    const a = round2(amount);
    if (a > 0) lines.push({ kind, code, label, amount: a });
  };

  const shiftHours = i.shift_hours > 0 ? i.shift_hours : 8;
  const lateUnder = i.late_minutes + i.undertime_minutes;
  const holidayOn = options.holiday_pay === true;
  const regWorked = holidayOn ? i.reg_holiday_worked ?? 0 : 0;
  const specWorked = holidayOn ? i.spec_holiday_worked ?? 0 : 0;
  const regPaidUnworked = holidayOn ? i.reg_holiday_paid_unworked ?? 0 : 0;
  const regRestWorked = holidayOn ? i.reg_rest_holiday_worked ?? 0 : 0;
  const specRestWorked = holidayOn ? i.spec_rest_holiday_worked ?? 0 : 0;
  // Unworked regular holidays are paid, so they are not absences.
  const absentDays = Math.max(0, i.absent_days - regPaidUnworked);
  let holidayExtra: Money = 0; // holiday premiums added on top of basic pay
  const snapshot: Record<string, number | string> = {
    days_scheduled: i.days_scheduled, days_present: i.days_present,
    paid_leave_days: i.paid_leave_days, absent_days: absentDays,
    late_minutes: i.late_minutes, undertime_minutes: i.undertime_minutes,
    shift_hours: shiftHours, periods_per_month: periodsPerMonth,
  };

  let monthlyBase: Money; // used for contributions and tax

  if (monthlyRate != null) {
    // Monthly-paid: fixed basic per period, less deductions for absences and lateness.
    const basic = monthlyRate / periodsPerMonth;
    const dailyRate = (monthlyRate * 12) / (i.days_per_week * WEEKS_PER_YEAR);
    const perMinute = dailyRate / (shiftHours * 60);
    add("EARNING", "BASIC", "Basic pay", basic);
    // Absence and lateness can reduce basic pay to zero, but never below it.
    let absence = options.deduct_absences ? round2(absentDays * dailyRate) : 0;
    let late = options.deduct_late ? round2(lateUnder * perMinute) : 0;
    const cap = round2(basic);
    if (absence + late > cap) {
      absence = Math.min(absence, cap);
      late = round2(Math.max(0, cap - absence));
    }
    add("DEDUCTION", "ABSENCE", `Absences (${absentDays} day${absentDays === 1 ? "" : "s"})`, absence);
    add("DEDUCTION", "LATE", `Late / undertime (${lateUnder} min)`, late);
    monthlyBase = monthlyRate;
    snapshot.monthly_rate = monthlyRate;
    snapshot.daily_rate = round2(dailyRate);
    holidayExtra += addHolidayLines(add, dailyRate, { regWorked, specWorked, regRestWorked, specRestWorked });
  } else if (hourlyRate != null) {
    // Hourly: paid for the hours actually covered (paid leave counts; lateness is subtracted).
    const paidPerDay = Math.max(0, shiftHours - (args.unpaidBreakHours ?? DEFAULT_UNPAID_BREAK_HOURS));
    // Paid unworked regular holidays count as paid days, like paid leave.
    let hours = (i.days_present + i.paid_leave_days + regPaidUnworked) * paidPerDay;
    if (options.deduct_late) hours -= lateUnder / 60;
    hours = Math.max(0, hours);
    add("EARNING", "BASIC", `Hours worked (${round2(hours)} h × ₱${hourlyRate})`, hours * hourlyRate);
    monthlyBase = round2(hours * hourlyRate) * periodsPerMonth;
    snapshot.hourly_rate = hourlyRate;
    snapshot.paid_hours = round2(hours);
    holidayExtra += addHolidayLines(add, hourlyRate * paidPerDay, { regWorked, specWorked, regRestWorked, specRestWorked });
  } else {
    monthlyBase = 0;
  }
  snapshot.monthly_base = round2(monthlyBase);
  if (holidayOn) {
    Object.assign(snapshot, {
      reg_holiday_worked: regWorked, spec_holiday_worked: specWorked, reg_holiday_paid_unworked: regPaidUnworked,
      reg_rest_holiday_worked: regRestWorked, spec_rest_holiday_worked: specRestWorked,
    });
  }

  let eeContributions = 0;
  if (options.gov_contributions && monthlyBase > 0) {
    const s = sss(monthlyBase), p = philhealth(monthlyBase), g = pagibig(monthlyBase);
    add("DEDUCTION", "SSS", "SSS", s.employee / periodsPerMonth);
    add("DEDUCTION", "PHILHEALTH", "PhilHealth", p.employee / periodsPerMonth);
    add("DEDUCTION", "PAGIBIG", "Pag-IBIG", g.employee / periodsPerMonth);
    add("EMPLOYER", "SSS_ER", "SSS (employer share)", s.employer / periodsPerMonth);
    add("EMPLOYER", "PHILHEALTH_ER", "PhilHealth (employer share)", p.employer / periodsPerMonth);
    add("EMPLOYER", "PAGIBIG_ER", "Pag-IBIG (employer share)", g.employer / periodsPerMonth);
    eeContributions = s.employee + p.employee + g.employee;
    snapshot.sss_msc = s.msc;
  }

  if (options.withhold_tax && monthlyBase > 0) {
    // Holiday premiums are taxable pay too; they are scaled to a month like the rest of the pay.
    const taxableMonthly = monthlyBase + holidayExtra * periodsPerMonth - eeContributions;
    add("DEDUCTION", "WHT", "Withholding tax", monthlyWithholding(taxableMonthly) / periodsPerMonth);
    snapshot.taxable_monthly = round2(taxableMonthly);
  }

  const gross = round2(lines.filter((l) => l.kind === "EARNING").reduce((s, l) => s + l.amount, 0));
  const deductions = round2(lines.filter((l) => l.kind === "DEDUCTION").reduce((s, l) => s + l.amount, 0));
  return { lines, snapshot, gross, deductions, net: round2(gross - deductions) };
}

// Adds the holiday premium lines and returns their total. `daily` is the daily rate.
function addHolidayLines(
  add: (kind: Line["kind"], code: string, label: string, amount: Money) => void,
  daily: number,
  n: { regWorked: number; specWorked: number; regRestWorked: number; specRestWorked: number }
): Money {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const parts: [string, string, number, number][] = [
    ["HOLIDAY_REG", "Regular holiday premium", n.regWorked, HOLIDAY_RATES.regularWorked],
    ["HOLIDAY_SPECIAL", "Special non-working day premium", n.specWorked, HOLIDAY_RATES.specialWorked],
    ["HOLIDAY_REG_REST", "Regular holiday on rest day", n.regRestWorked, HOLIDAY_RATES.regularRestWorked],
    ["HOLIDAY_SPECIAL_REST", "Special non-working day on rest day", n.specRestWorked, HOLIDAY_RATES.specialRestWorked],
  ];
  let total = 0;
  for (const [code, label, days, rate] of parts) {
    if (!(days > 0)) continue;
    const amount = round2(days * daily * rate);
    add("EARNING", code, `${label} (${days} day${days === 1 ? "" : "s"} × ${pct(rate)})`, amount);
    total += amount;
  }
  return total;
}

// --- 13th month pay (PD 851) ---------------------------------------------------------------
// Total basic salary actually earned in the calendar year, divided by 12. Absences and lateness
// already reduce the basic salary earned. Allowances, bonuses and overtime are not included.

export const THIRTEENTH_MONTH_BASIS = "13th month pay: basic salary earned in the year ÷ 12 (PD 851)";
// 13th month pay and other benefits are income-tax exempt up to this combined amount (TRAIN law).
export const THIRTEENTH_TAX_EXEMPT_LIMIT = 90_000;

export function computeThirteenthMonth(basis: {
  basic_pay: number;
  absence_deduction: number;
  late_deduction: number;
}): { basicEarned: Money; amount: Money; taxableExcess: Money } {
  const basicEarned = Math.max(0, round2(basis.basic_pay - basis.absence_deduction - basis.late_deduction));
  const amount = round2(basicEarned / 12);
  // At least this much is taxable: it ignores other benefits that count toward the same limit.
  return { basicEarned, amount, taxableExcess: Math.max(0, round2(amount - THIRTEENTH_TAX_EXEMPT_LIMIT)) };
}
