// Payroll calculations. Pure functions: no database, no dates, easy to test.
//
// Government rates below are BUILT IN and change from time to time. Each payroll run stores
// RATES_VERSION so you can tell which schedule produced it. Have your accountant confirm them
// against the current SSS, PhilHealth, Pag-IBIG and BIR circulars before relying on payslips.

export const RATES_VERSION =
  "SSS 2025 (5% employee, MSC 5,000-35,000) · PhilHealth 5% (floor 10,000, cap 100,000) · Pag-IBIG 2% (cap 10,000) · BIR TRAIN 2023 table";

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
};

export type PayInputs = {
  days_scheduled: number;
  days_present: number;
  paid_leave_days: number;
  absent_days: number;
  late_minutes: number;
  undertime_minutes: number;
  shift_hours: number;
  days_per_week: number;
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
  const snapshot: Record<string, number | string> = {
    days_scheduled: i.days_scheduled, days_present: i.days_present,
    paid_leave_days: i.paid_leave_days, absent_days: i.absent_days,
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
    if (options.deduct_absences) {
      add("DEDUCTION", "ABSENCE", `Absences (${i.absent_days} day${i.absent_days === 1 ? "" : "s"})`, i.absent_days * dailyRate);
    }
    if (options.deduct_late) {
      add("DEDUCTION", "LATE", `Late / undertime (${lateUnder} min)`, lateUnder * perMinute);
    }
    monthlyBase = monthlyRate;
    snapshot.monthly_rate = monthlyRate;
    snapshot.daily_rate = round2(dailyRate);
  } else if (hourlyRate != null) {
    // Hourly: paid for the hours actually covered (paid leave counts; lateness is subtracted).
    const paidPerDay = Math.max(0, shiftHours - (args.unpaidBreakHours ?? DEFAULT_UNPAID_BREAK_HOURS));
    let hours = (i.days_present + i.paid_leave_days) * paidPerDay;
    if (options.deduct_late) hours -= lateUnder / 60;
    hours = Math.max(0, hours);
    add("EARNING", "BASIC", `Hours worked (${round2(hours)} h × ₱${hourlyRate})`, hours * hourlyRate);
    monthlyBase = round2(hours * hourlyRate) * periodsPerMonth;
    snapshot.hourly_rate = hourlyRate;
    snapshot.paid_hours = round2(hours);
  } else {
    monthlyBase = 0;
  }
  snapshot.monthly_base = round2(monthlyBase);

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
    const taxableMonthly = monthlyBase - eeContributions;
    add("DEDUCTION", "WHT", "Withholding tax", monthlyWithholding(taxableMonthly) / periodsPerMonth);
    snapshot.taxable_monthly = round2(taxableMonthly);
  }

  const gross = round2(lines.filter((l) => l.kind === "EARNING").reduce((s, l) => s + l.amount, 0));
  const deductions = round2(lines.filter((l) => l.kind === "DEDUCTION").reduce((s, l) => s + l.amount, 0));
  return { lines, snapshot, gross, deductions, net: round2(gross - deductions) };
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
