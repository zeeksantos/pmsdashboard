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
