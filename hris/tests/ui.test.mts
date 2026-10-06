import test from "node:test";
import assert from "node:assert/strict";
import { daysInMonth, expandRange, monthGrid, monthOf, monthTitle } from "../src/lib/calendar.ts";
import { activeHref, allHrefs, simplifyGroups, type NavGroup } from "../src/lib/nav.ts";

test("month grid: Sunday-first weeks, padded with blanks", () => {
  const oct = monthGrid(2026, 10); // Oct 1, 2026 is a Thursday
  assert.deepEqual(oct[0], [null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.equal(oct.every((w) => w.length === 7), true);
  assert.equal(oct.flat().filter(Boolean).length, 31);
  assert.equal(oct.at(-1)!.filter(Boolean).at(-1), "2026-10-31");
});

test("month grid: a month that starts on Sunday has no leading blanks; leap years work", () => {
  assert.equal(monthGrid(2026, 2)[0][0], "2026-02-01"); // Feb 1, 2026 is a Sunday
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(monthGrid(2028, 2).flat().filter(Boolean).length, 29);
});

test("date ranges are inclusive and bounded", () => {
  assert.deepEqual(expandRange("2026-10-05", "2026-10-07"), ["2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.deepEqual(expandRange("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(expandRange("2026-10-05", "2026-10-05"), ["2026-10-05"]);
  assert.equal(expandRange("2020-01-01", "2030-01-01").length, 400);
  assert.deepEqual(expandRange("2026-10-07", "2026-10-05"), []);
});

test("month bounds and title", () => {
  assert.deepEqual(monthOf("2026-10-03"), { year: 2026, month: 10, first: "2026-10-01", last: "2026-10-31" });
  assert.equal(monthOf("2028-02-10").last, "2028-02-29");
  assert.equal(monthTitle(2026, 10), "October 2026");
});

test("the most specific menu link is the current one", () => {
  const hrefs = ["/", "/leave", "/leave/approvals", "/employees", "/employees/abc-123", "/payroll", "/payslips", "/settings"];
  assert.equal(activeHref("/", hrefs), "/");
  assert.equal(activeHref("/leave", hrefs), "/leave");
  assert.equal(activeHref("/leave/approvals", hrefs), "/leave/approvals");
  assert.equal(activeHref("/leave/settings", hrefs), "/leave"); // a sub-page of My Leave
  assert.equal(activeHref("/employees/xyz", hrefs), "/employees"); // someone else's profile
  assert.equal(activeHref("/employees/abc-123/edit", hrefs), "/employees/abc-123"); // my own profile
  assert.equal(activeHref("/payroll/run-1/slip-9", hrefs), "/payroll");
  assert.equal(activeHref("/payslips", hrefs), "/payslips");
  assert.equal(activeHref("/payrollx", hrefs), null); // not a sub-path of /payroll
  assert.equal(activeHref("/nowhere", hrefs), null);
  assert.equal(activeHref("/", ["/leave"]), null); // "/" only matches the dashboard exactly
});

test("single-item groups become plain links; empty groups disappear", () => {
  const groups: NavGroup[] = [
    { label: "Dashboard", icon: "dashboard", href: "/" },
    { label: "Time & Attendance", icon: "clock", items: [{ href: "/time-clock", label: "Time Clock" }, { href: "/attendance", label: "My Attendance" }] },
    { label: "Leave", icon: "plane", items: [{ href: "/leave", label: "My Leave" }] },
    { label: "People", icon: "users", items: [] },
  ];
  const out = simplifyGroups(groups);
  assert.deepEqual(out.map((g) => g.label), ["Dashboard", "Time & Attendance", "My Leave"]);
  assert.deepEqual(out[2], { label: "My Leave", icon: "plane", href: "/leave" });
  assert.deepEqual(allHrefs(out), ["/", "/time-clock", "/attendance", "/leave"]);
});

import { shiftMonth, yearlyDate } from "../src/lib/calendar.ts";
import { generatePassword } from "../src/lib/password.ts";

test("shiftMonth crosses year boundaries both ways", () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 6, 0), { year: 2026, month: 6 });
  assert.deepEqual(shiftMonth(2026, 3, -15), { year: 2024, month: 12 });
});

test("yearlyDate puts birthdays in the viewed year and handles Feb 29", () => {
  assert.equal(yearlyDate("1995-10-18", 2026, 10), "2026-10-18");
  assert.equal(yearlyDate("1995-10-18", 2026, 11), null);
  assert.equal(yearlyDate("2000-02-29", 2026, 2), "2026-02-28");
  assert.equal(yearlyDate("2000-02-29", 2028, 2), "2028-02-29");
});

test("generatePassword is long enough, mixed, and avoids look-alike characters", () => {
  for (let i = 0; i < 50; i++) {
    const p = generatePassword();
    assert.equal(p.length, 12);
    assert.match(p, /[A-Z]/);
    assert.match(p, /[a-z]/);
    assert.match(p, /[0-9]/);
    assert.doesNotMatch(p, /[0O1lI]/);
  }
});

import { canCreateLogins, loginRolesFor } from "../src/lib/roles.ts";

test("who can hand out which login access levels", () => {
  assert.deepEqual(loginRolesFor("hr"), ["employee", "manager", "hr"]);
  assert.equal(loginRolesFor("admin").includes("owner"), false);
  assert.equal(loginRolesFor("admin").includes("admin"), true);
  assert.equal(loginRolesFor("owner").includes("owner"), true);
  for (const r of ["employee", "manager", "finance"] as const) assert.equal(canCreateLogins(r), false);
  assert.equal(canCreateLogins("hr"), true);
});

import { validateCompanyEvent } from "../src/lib/company-events.ts";

test("company event validation", () => {
  const ok = { title: "Outing", kind: "EVENT", start: "2026-11-05", end: "", note: "" };
  assert.equal(validateCompanyEvent(ok), null);
  assert.equal(validateCompanyEvent({ ...ok, end: "2026-11-07" }), null);
  assert.match(validateCompanyEvent({ ...ok, title: "  " })!, /title/i);
  assert.match(validateCompanyEvent({ ...ok, kind: "PARTY" })!, /type/i);
  assert.match(validateCompanyEvent({ ...ok, start: "" })!, /start date/i);
  assert.match(validateCompanyEvent({ ...ok, start: "2026-13-45" })!, /start date/i);
  assert.match(validateCompanyEvent({ ...ok, end: "2026-11-01" })!, /before/i);
  assert.match(validateCompanyEvent({ ...ok, note: "x".repeat(501) })!, /too long/i);
});
