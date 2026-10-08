// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { annualTax, computePayslip, computeThirteenthMonth, monthlyWithholding, pagibig, philhealth, sss } from "../src/lib/payroll.ts";
import { suggestPeriod } from "../src/lib/dates.ts";

const all = { deduct_absences: true, deduct_late: true, gov_contributions: true, withhold_tax: true };
const none = { deduct_absences: false, deduct_late: false, gov_contributions: false, withhold_tax: false };
const full = {
  days_scheduled: 11, days_present: 11, paid_leave_days: 0, absent_days: 0,
  late_minutes: 0, undertime_minutes: 0, shift_hours: 9, days_per_week: 5,
};

test("SSS: 5% employee / 10% employer of the salary credit, 5,000 to 35,000", () => {
  assert.deepEqual(sss(30000), { msc: 30000, employee: 1500, employer: 3000 });
  assert.equal(sss(3000).msc, 5000);
  assert.equal(sss(80000).msc, 35000);
  assert.equal(sss(5249).msc, 5000);
  assert.equal(sss(5250).msc, 5500);
  assert.equal(sss(34750).msc, 35000);
});

test("PhilHealth: 5% split equally, base between 10,000 and 100,000", () => {
  assert.deepEqual(philhealth(30000), { employee: 750, employer: 750 });
  assert.deepEqual(philhealth(8000), { employee: 250, employer: 250 });
  assert.deepEqual(philhealth(150000), { employee: 2500, employer: 2500 });
});

test("Pag-IBIG: 2% each on a base capped at 10,000", () => {
  assert.deepEqual(pagibig(30000), { employee: 200, employer: 200 });
  assert.deepEqual(pagibig(6000), { employee: 120, employer: 120 });
  assert.deepEqual(pagibig(1000), { employee: 10, employer: 20 });
});

test("Income tax follows the TRAIN brackets", () => {
  assert.equal(annualTax(250000), 0);
  assert.equal(annualTax(330600), 12090);
  assert.equal(annualTax(400000), 22500);
  assert.equal(annualTax(800000), 102500);
  assert.equal(annualTax(2000000), 402500);
  assert.equal(annualTax(10000000), 2402500 + 2000000 * 0.35);
  assert.equal(monthlyWithholding(27550), 1007.5);
  assert.equal(monthlyWithholding(20000), 0);
});

test("30,000/month, semi-monthly, full attendance", () => {
  const r = computePayslip({ monthlyRate: 30000, hourlyRate: null, periodsPerMonth: 2, inputs: full, options: all });
  assert.equal(r.gross, 15000);
  assert.equal(r.deductions, 1728.75); // SSS 750 + PhilHealth 375 + Pag-IBIG 100 + tax 503.75
  assert.equal(r.net, 13271.25);
  assert.deepEqual(r.lines.filter((l) => l.kind === "EMPLOYER").map((l) => l.amount), [1500, 375, 100]);
});

test("the same salary paid monthly is exactly twice the semi-monthly figures", () => {
  const r = computePayslip({ monthlyRate: 30000, hourlyRate: null, periodsPerMonth: 1, inputs: full, options: all });
  assert.equal(r.net, 26542.5);
});

test("low salary owes no withholding tax", () => {
  const r = computePayslip({ monthlyRate: 15000, hourlyRate: null, periodsPerMonth: 2, inputs: full, options: all });
  assert.equal(r.lines.some((l) => l.code === "WHT"), false);
});

test("absences and lateness use the daily rate (20,000 x 12 / 261 days)", () => {
  const r = computePayslip({
    monthlyRate: 20000, hourlyRate: null, periodsPerMonth: 2,
    inputs: { ...full, absent_days: 2, late_minutes: 20, undertime_minutes: 30 },
    options: { ...none, deduct_absences: true, deduct_late: true },
  });
  assert.equal(r.lines.find((l) => l.code === "ABSENCE")?.amount, 1839.08);
  assert.equal(r.lines.find((l) => l.code === "LATE")?.amount, 85.14); // 919.5402 / 540 min x 50 min
  assert.equal(r.net, 8075.78);
});

test("absence and lateness can't take away more than the basic pay", () => {
  // 20,000/month semi-monthly: basic 10,000, but 11 absent days at 919.54 would be 10,114.94
  const r = computePayslip({
    monthlyRate: 20000, hourlyRate: null, periodsPerMonth: 2,
    inputs: { ...full, days_present: 0, absent_days: 11, late_minutes: 30 },
    options: { ...none, deduct_absences: true, deduct_late: true },
  });
  assert.equal(r.gross, 10000);
  assert.equal(r.lines.find((l) => l.code === "ABSENCE")?.amount, 10000);
  assert.equal(r.lines.find((l) => l.code === "LATE"), undefined); // nothing left to take
  assert.equal(r.net, 0);
  // absence just under the cap leaves room for a little lateness
  const partial = computePayslip({
    monthlyRate: 20000, hourlyRate: null, periodsPerMonth: 2,
    inputs: { ...full, absent_days: 10, late_minutes: 600 },
    options: { ...none, deduct_absences: true, deduct_late: true },
  });
  assert.equal(partial.deductions, 10000);
  assert.equal(partial.net, 0);
});

test("switched-off options add no deduction lines", () => {
  const r = computePayslip({
    monthlyRate: 20000, hourlyRate: null, periodsPerMonth: 2,
    inputs: { ...full, absent_days: 2, late_minutes: 20 }, options: none,
  });
  assert.deepEqual(r.lines.map((l) => l.code), ["BASIC"]);
});

test("hourly staff are paid for hours covered; paid leave counts, lateness is subtracted", () => {
  const late = computePayslip({
    monthlyRate: null, hourlyRate: 150, periodsPerMonth: 2,
    inputs: { ...full, days_present: 6, absent_days: 5, late_minutes: 30, undertime_minutes: 30 },
    options: { ...none, deduct_late: true },
  });
  assert.equal(late.gross, 7050); // 6 days x 8 paid hours - 1 hour = 47 h x 150
  const leave = computePayslip({
    monthlyRate: null, hourlyRate: 150, periodsPerMonth: 2,
    inputs: { ...full, days_present: 5, paid_leave_days: 1, absent_days: 5 }, options: none,
  });
  assert.equal(leave.gross, 7200);
});

test("nobody goes negative, and no attendance means an empty payslip", () => {
  const r = computePayslip({
    monthlyRate: null, hourlyRate: 150, periodsPerMonth: 2,
    inputs: { ...full, days_present: 0, absent_days: 11, late_minutes: 100 }, options: all,
  });
  assert.deepEqual({ gross: r.gross, net: r.net, lines: r.lines.length }, { gross: 0, net: 0, lines: 0 });
});

test("a monthly rate wins when both rates are set", () => {
  const r = computePayslip({ monthlyRate: 20000, hourlyRate: 500, periodsPerMonth: 2, inputs: full, options: none });
  assert.equal(r.gross, 10000);
});

test("suggested period is the most recently finished semi-monthly one", () => {
  assert.deepEqual(suggestPeriod("2026-10-20"), { start: "2026-10-01", end: "2026-10-15" });
  assert.deepEqual(suggestPeriod("2026-10-16"), { start: "2026-10-01", end: "2026-10-15" });
  assert.deepEqual(suggestPeriod("2026-10-15"), { start: "2026-09-16", end: "2026-09-30" });
  assert.deepEqual(suggestPeriod("2026-03-02"), { start: "2026-02-16", end: "2026-02-28" });
  assert.deepEqual(suggestPeriod("2028-03-02"), { start: "2028-02-16", end: "2028-02-29" }); // leap year
  assert.deepEqual(suggestPeriod("2027-01-05"), { start: "2026-12-16", end: "2026-12-31" }); // year rollover
});

test("13th month = basic earned in the year / 12, after absences and lateness", () => {
  // full year at 30,000/month: 360,000 basic -> 30,000
  assert.deepEqual(
    computeThirteenthMonth({ basic_pay: 360000, absence_deduction: 0, late_deduction: 0 }),
    { basicEarned: 360000, amount: 30000, taxableExcess: 0 });
  // absences and lateness reduce the basic salary earned
  assert.equal(computeThirteenthMonth({ basic_pay: 240000, absence_deduction: 1000, late_deduction: 200 }).amount, 19900);
  // joined mid-year: only six months of basic, so pro-rated automatically (60,000 / 12)
  assert.equal(computeThirteenthMonth({ basic_pay: 60000, absence_deduction: 0, late_deduction: 0 }).amount, 5000);
  // rounds to the centavo
  assert.equal(computeThirteenthMonth({ basic_pay: 100000, absence_deduction: 0, late_deduction: 0 }).amount, 8333.33);
});

test("13th month never goes negative, and flags the part above the 90,000 tax-exempt limit", () => {
  assert.equal(computeThirteenthMonth({ basic_pay: 1000, absence_deduction: 5000, late_deduction: 0 }).amount, 0);
  const big = computeThirteenthMonth({ basic_pay: 1_500_000, absence_deduction: 0, late_deduction: 0 });
  assert.equal(big.amount, 125000);
  assert.equal(big.taxableExcess, 35000);
});

// --- Holiday pay (DOLE rules) --------------------------------------------------------------
// 30,000 a month, 5-day week: daily rate = 30,000 x 12 / (5 x 52.2) = 1,379.31
const holidayOn = { ...none, holiday_pay: true };
const base = { monthlyRate: 30000, hourlyRate: null, periodsPerMonth: 2 as const };
const lineAmount = (r: ReturnType<typeof computePayslip>, code: string) =>
  r.lines.find((l) => l.code === code)?.amount ?? 0;

test("holiday pay does nothing when the option is off", () => {
  const r = computePayslip({ ...base, inputs: { ...full, reg_holiday_worked: 2, spec_holiday_worked: 1 }, options: none });
  assert.equal(r.gross, 15000);
  assert.equal(r.lines.some((l) => l.code.startsWith("HOLIDAY")), false);
});

test("regular holiday worked: +100% of the daily rate on top of basic (200% in all)", () => {
  const r = computePayslip({ ...base, inputs: { ...full, reg_holiday_worked: 1 }, options: holidayOn });
  assert.equal(lineAmount(r, "HOLIDAY_REG"), 1379.31);
  assert.equal(r.gross, 16379.31);
});

test("special non-working day worked: +30% of the daily rate (130% in all)", () => {
  const r = computePayslip({ ...base, inputs: { ...full, spec_holiday_worked: 1 }, options: holidayOn });
  assert.equal(lineAmount(r, "HOLIDAY_SPECIAL"), 413.79);
});

test("holidays worked on the rest day: 260% regular, 150% special, all on top of basic", () => {
  const r = computePayslip({
    ...base, inputs: { ...full, reg_rest_holiday_worked: 1, spec_rest_holiday_worked: 1 }, options: holidayOn,
  });
  assert.equal(lineAmount(r, "HOLIDAY_REG_REST"), 3586.21);
  assert.equal(lineAmount(r, "HOLIDAY_SPECIAL_REST"), 2068.97);
});

test("an unworked regular holiday is not an absence for a monthly-paid employee", () => {
  const withAbsence = { ...full, days_present: 10, absent_days: 1 };
  const off = computePayslip({ ...base, inputs: { ...withAbsence, reg_holiday_paid_unworked: 1 }, options: { ...none, deduct_absences: true } });
  assert.equal(lineAmount(off, "ABSENCE"), 1379.31); // option off: still treated as an absence
  const on = computePayslip({ ...base, inputs: { ...withAbsence, reg_holiday_paid_unworked: 1 }, options: { ...none, deduct_absences: true, holiday_pay: true } });
  assert.equal(lineAmount(on, "ABSENCE"), 0);
  assert.equal(on.net, 15000);
});

test("a real absence next to the holiday is still deducted", () => {
  const r = computePayslip({
    ...base,
    inputs: { ...full, days_present: 9, absent_days: 2, reg_holiday_paid_unworked: 1 },
    options: { ...none, deduct_absences: true, holiday_pay: true },
  });
  assert.equal(lineAmount(r, "ABSENCE"), 1379.31); // 2 absent days, one of them a paid holiday
});

test("hourly: an unworked regular holiday is paid like a paid leave day", () => {
  // shift 9 h with a 1 h break = 8 paid hours a day, at 200 an hour
  const args = { monthlyRate: null, hourlyRate: 200, periodsPerMonth: 2 as const };
  const without = computePayslip({ ...args, inputs: { ...full, days_present: 10 }, options: holidayOn });
  const withHoliday = computePayslip({ ...args, inputs: { ...full, days_present: 10, reg_holiday_paid_unworked: 1 }, options: holidayOn });
  assert.equal(without.gross, 16000);
  assert.equal(withHoliday.gross, 17600); // + 1 day x 8 h x 200
  const worked = computePayslip({ ...args, inputs: { ...full, days_present: 11, reg_holiday_worked: 1 }, options: holidayOn });
  assert.equal(lineAmount(worked, "HOLIDAY_REG"), 1600); // +100% of 8 h x 200
});

test("holiday premiums are taxable and raise withholding", () => {
  const taxOnly = { ...none, withhold_tax: true, holiday_pay: true };
  const a = computePayslip({ ...base, inputs: full, options: taxOnly });
  const b = computePayslip({ ...base, inputs: { ...full, reg_holiday_worked: 3 }, options: taxOnly });
  assert.ok(lineAmount(b, "WHT") > lineAmount(a, "WHT"));
});

// --- Holiday pay summary report --------------------------------------------------------------
import { holidaySummary } from "../src/lib/holiday-report.ts";

test("holiday report: days come from the snapshot, pesos from the payslip lines", () => {
  const worked = computePayslip({ ...base, inputs: { ...full, reg_holiday_worked: 1, spec_rest_holiday_worked: 1 }, options: holidayOn });
  const unworked = computePayslip({ ...base, inputs: { ...full, days_present: 10, absent_days: 1, reg_holiday_paid_unworked: 1 }, options: holidayOn });
  const plain = computePayslip({ ...base, inputs: full, options: holidayOn });
  const slip = (id: string, name: string, r: typeof worked) => ({
    employee_id: id, name, employee_no: id, snapshot: r.snapshot, lines: r.lines,
  });
  const out = holidaySummary([slip("a", "Ana", worked), slip("b", "Ben", unworked), slip("c", "Cara", plain)], true);

  assert.equal(out.included, true);
  assert.deepEqual(out.rows.map((r) => r.name), ["Ana", "Ben"]); // Cara had no holiday activity
  assert.equal(out.rows[0].total, 3448.28); // 1,379.31 + 2,068.97
  assert.equal(out.rows[1].total, 0);
  assert.equal(out.rows[1].paidUnworked, 1);
  assert.equal(out.totals.total, 3448.28);
  assert.equal(out.totals.paidUnworked, 1);
  assert.equal(out.totals.days.HOLIDAY_REG, 1);
  assert.equal(out.totals.days.HOLIDAY_SPECIAL_REST, 1);
  assert.equal(out.totals.amounts.HOLIDAY_REG, 1379.31);
});

test("holiday report: a run made without the option reports nothing", () => {
  const r = computePayslip({ ...base, inputs: { ...full, reg_holiday_worked: 2 }, options: none });
  const out = holidaySummary([{ employee_id: "a", name: "Ana", employee_no: "a", snapshot: r.snapshot, lines: r.lines }], false);
  assert.equal(out.included, false);
  assert.equal(out.rows.length, 0);
  assert.equal(out.totals.total, 0);
});

// --- Field / out-of-office days ----------------------------------------------------------------
test("field days are recorded on the payslip and cost nothing without an allowance", () => {
  const r = computePayslip({ ...base, inputs: { ...full, field_days: 3 }, options: none });
  assert.equal(r.snapshot.field_days, 3);
  assert.equal(r.gross, 15000);
  assert.equal(r.lines.some((l) => l.code === "FIELD_ALLOWANCE"), false);
});

test("field allowance: days x the daily amount, as an earning", () => {
  const r = computePayslip({ ...base, inputs: { ...full, field_days: 3 }, options: { ...none, field_allowance_per_day: 250 } });
  assert.equal(r.lines.find((l) => l.code === "FIELD_ALLOWANCE")?.amount, 750);
  assert.equal(r.gross, 15750);
  assert.equal(r.snapshot.field_allowance, 750);
});

test("no field days means no allowance line, even with a daily amount set", () => {
  const r = computePayslip({ ...base, inputs: { ...full, field_days: 0 }, options: { ...none, field_allowance_per_day: 250 } });
  assert.equal(r.gross, 15000);
  assert.equal(r.lines.some((l) => l.code === "FIELD_ALLOWANCE"), false);
});

test("field allowance is taxable and raises withholding", () => {
  const taxOnly = { ...none, withhold_tax: true };
  const a = computePayslip({ ...base, inputs: { ...full, field_days: 5 }, options: taxOnly });
  const b = computePayslip({ ...base, inputs: { ...full, field_days: 5 }, options: { ...taxOnly, field_allowance_per_day: 500 } });
  assert.ok(lineAmount(b, "WHT") > lineAmount(a, "WHT"));
});

test("the field allowance works for hourly employees too", () => {
  const r = computePayslip({
    monthlyRate: null, hourlyRate: 200, periodsPerMonth: 2,
    inputs: { ...full, days_present: 10, field_days: 2 }, options: { ...none, field_allowance_per_day: 300 },
  });
  assert.equal(r.lines.find((l) => l.code === "FIELD_ALLOWANCE")?.amount, 600);
  assert.equal(r.gross, 16600);
});

// --- Leave pay summary report ----------------------------------------------------------------
import { dailyValue, leaveSummary } from "../src/lib/leave-report.ts";

test("leave report: paid leave valued at the daily rate, unpaid only when absences are deducted", () => {
  const monthly = computePayslip({ ...base, inputs: { ...full, days_present: 8, paid_leave_days: 2, absent_days: 1 }, options: { ...none, deduct_absences: true } });
  const slip = { employee_id: "m", name: "Mia", employee_no: "E1", snapshot: monthly.snapshot };
  assert.equal(dailyValue(monthly.snapshot), 1379.31);
  const leave = [
    { employee_id: "m", leave_type: "Vacation Leave", is_paid: true, days: 2 },
    { employee_id: "m", leave_type: "Unpaid Leave", is_paid: false, days: 1 },
  ];
  const on = leaveSummary([slip], leave, true);
  assert.equal(on.totals.paidDays, 2);
  assert.equal(on.totals.paidValue, 2758.62);
  assert.equal(on.totals.unpaidDays, 1);
  assert.equal(on.totals.unpaidValue, 1379.31);
  assert.deepEqual(on.mismatched, []);
  const off = leaveSummary([slip], leave, false);
  assert.equal(off.totals.unpaidDays, 1);
  assert.equal(off.totals.unpaidValue, 0); // monthly, absences not deducted: no pay was withheld
  assert.deepEqual(on.byType.map((t) => t.leave_type), ["Vacation Leave", "Unpaid Leave"]); // paid types first
});

test("leave report: hourly staff are valued at paid hours x rate, and unpaid leave is simply not paid", () => {
  const hourly = computePayslip({
    monthlyRate: null, hourlyRate: 200, periodsPerMonth: 2,
    inputs: { ...full, days_present: 9, paid_leave_days: 1, absent_days: 1 }, options: none,
  });
  const slip = { employee_id: "h", name: "Hal", employee_no: "E2", snapshot: hourly.snapshot };
  assert.equal(dailyValue(hourly.snapshot), 1600); // 9 h shift - 1 h break = 8 h x 200
  const out = leaveSummary([slip], [
    { employee_id: "h", leave_type: "Sick Leave", is_paid: true, days: 1 },
    { employee_id: "h", leave_type: "Unpaid Leave", is_paid: false, days: 1 },
  ], false);
  assert.equal(out.totals.paidValue, 1600);
  assert.equal(out.totals.unpaidValue, 1600);
});

test("leave report: flags employees whose leave changed after the payslip was calculated", () => {
  const r = computePayslip({ ...base, inputs: { ...full, days_present: 9, paid_leave_days: 2, absent_days: 0 }, options: none });
  const slip = { employee_id: "x", name: "Xan", employee_no: "E3", snapshot: r.snapshot };
  const out = leaveSummary([slip], [{ employee_id: "x", leave_type: "Vacation Leave", is_paid: true, days: 3 }], true);
  assert.deepEqual(out.mismatched, ["Xan"]);
  // leave for someone with no payslip in the run is ignored
  assert.equal(leaveSummary([slip], [{ employee_id: "zzz", leave_type: "Vacation Leave", is_paid: true, days: 5 }], true).rows.length, 0);
});

// --- Overtime (DOLE rules) -----------------------------------------------------------------
const otOn = { ...none, overtime_pay: true };

test("overtime does nothing when the option is off", () => {
  const r = computePayslip({ ...base, inputs: { ...full, overtime_hours: { ORDINARY: 4 } }, options: none });
  assert.equal(r.gross, 15000);
  assert.equal(r.lines.some((l) => l.code === "OVERTIME"), false);
});

test("overtime pays hourly rate x hours x the rate for the kind of day", () => {
  const r = computePayslip({ ...base, inputs: { ...full, overtime_hours: { ORDINARY: 4, REST: 2, REGULAR: 1 } }, options: otOn });
  const hourly = (r.snapshot.daily_rate as number) / ((full.shift_hours as number) - 1);
  const money = (n: number) => Math.round(n * 100) / 100;
  const expected = money(4 * hourly * 1.25) + money(2 * hourly * 1.69) + money(1 * hourly * 2.6);
  const got = r.lines.filter((l) => l.code === "OVERTIME").reduce((s, l) => s + l.amount, 0);
  assert.equal(r.lines.filter((l) => l.code === "OVERTIME").length, 3);
  assert.ok(Math.abs(got - expected) < 0.02, `${got} vs ${expected}`);
  assert.equal(r.snapshot.overtime_hours, 7);
  assert.ok(Math.abs(r.gross - (15000 + got)) < 0.02);
});

test("hourly staff overtime uses their hourly rate directly", () => {
  const r = computePayslip({
    monthlyRate: null, hourlyRate: 200, periodsPerMonth: 2,
    inputs: { ...full, overtime_hours: { ORDINARY: 2, SPECIAL_REST: 1 } }, options: otOn,
  });
  assert.equal(lineAmount(r, "OVERTIME"), 500); // first line: 2 h x 200 x 125%
  const total = r.lines.filter((l) => l.code === "OVERTIME").reduce((s, l) => s + l.amount, 0);
  assert.equal(total, 500 + 390); // + 1 h x 200 x 195%
});

test("overtime is taxable and counts toward 13th month only when given", () => {
  const taxOn = { ...otOn, withhold_tax: true };
  const a = computePayslip({ ...base, inputs: full, options: taxOn });
  const b = computePayslip({ ...base, inputs: { ...full, overtime_hours: { ORDINARY: 20 } }, options: taxOn });
  assert.ok((b.snapshot.taxable_monthly as number) > (a.snapshot.taxable_monthly as number));
  assert.equal(computeThirteenthMonth({ basic_pay: 120000, absence_deduction: 0, late_deduction: 0 }).amount, 10000);
  assert.equal(computeThirteenthMonth({ basic_pay: 120000, absence_deduction: 0, late_deduction: 0, overtime_pay: 12000 }).amount, 11000);
});
