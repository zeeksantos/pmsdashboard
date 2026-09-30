# Z-Fast HRIS

Standalone HRIS for Z-Fast Digital Marketing Agency (fully online, PH, Asia/Manila).
Kept in its own folder with its own migrations; independent of the PMS in the repo root.

Stack: Next.js + TypeScript, Supabase (Postgres/Auth/Storage), Tailwind.

## Scope v1
Employee records and biodata, fixed schedules, web time in/out with GPS capture,
role-based access, audit log. Payroll, leave, and performance are later phases.

## Access matrix
| Data | Employee | Manager | HR | Finance | Admin/Owner |
|---|---|---|---|---|---|
| Own schedule/logs/profile | yes | yes | yes | yes | yes |
| Everyone's attendance + schedules | no | yes | yes | no | yes |
| Biodata, gov IDs, documents | own | no | yes | no | yes |
| Salary | no | no | no | yes | yes |
| Roles, audit log | no | no | no | no | yes |

## Attendance rules
- Fixed schedule per employee; rest days and holidays count as normal days.
- 15-minute grace: clock-in up to 15 min after start is not late; clock-out
  up to 15 min before end is not undertime.
- GPS is recorded on every time in/out (not enforced).

## Migrations
Run in order: 0001 (tables), 0002 (functions, audit, RLS), 0003 (link login + set role), 0004 (salary constraints), 0005 (document storage), 0006 (leave), 0007 (employee self-service), 0008 (payroll), 0009 (13th month).

## Leave rules (defaults, editable in Leave settings)
- Types: Vacation 5, Sick 5, Emergency 3 (capped), Unpaid (uncapped). Days are per calendar year, no carry-over.
- Days are counted against the employee's own working days (Mon-Fri if no schedule).
- A request can't overlap another pending/approved one, can't exceed the balance, and can't span two years.
- Approver: the employee's direct manager (reports to) or HR/admin/owner. Nobody approves their own request (except the owner).
- Employees may cancel pending requests, or approved ones that haven't started; HR can cancel any.

## Employee self-service
Employees can edit their own nickname, phone, personal email, address, and emergency contact
(My Account), and change their password. Everything else stays HR-only. Enforced by the
`update_my_contact` database function; employees have no write policy on biodata.

## Forgot password (emailed code)
Login page -> "Forgot your password?" -> email -> 6-digit code -> new password. Uses Supabase's
`resetPasswordForEmail` + `verifyOtp` (no redirect URLs needed, works across devices). On success other
sessions for that account are signed out. The response is the same whether or not the email has an account.

One-time Supabase setup (Authentication -> Email Templates -> "Reset Password"): the default template only has a
link, so add the code:

    Subject: Your Z-Fast HRIS password reset code
    Body:    <h2>Reset your password</h2>
             <p>Your code is: <b>{{ .Token }}</b></p>
             <p>It expires in 1 hour. If you didn't ask for this, ignore this email.</p>

Supabase's built-in email sender is heavily rate-limited (a few emails per hour) and meant for testing.
Before rolling out to staff, add your own SMTP under Authentication -> SMTP Settings.

## Payroll
Finance, admin and owner create a draft run for a period, review and adjust each payslip, then finalize (locks it).
Employees see only their own payslips, and only after the run is finalized. Only admin/owner can reopen a run.

- Basic pay: monthly rate / periods per month; hourly staff = hourly rate x paid hours (shift minus a 1-hour break).
- Optional per run: absence and late/undertime deductions (daily rate = monthly x 12 / (days per week x 52.2)),
  SSS / PhilHealth / Pag-IBIG (employee share deducted, employer share recorded), and income tax (TRAIN, annualized).
- Government rates are built into `src/lib/payroll.ts` and each run stores which version it used
  (`RATES_VERSION`). They change over time: have your accountant confirm them, and update that file when they do.
- Not covered yet: 13th month pay, overtime, holiday premiums, final pay on resignation, loans as a schedule
  (add one-off adjustments by hand), BIR/SSS filing exports.
- Finance reads attendance and leave only through `payroll_inputs` (totals per employee, no details).

Tests for the calculations: `npm test`.

## 13th month pay
A second kind of payroll run, one per calendar year (Payroll page -> "13th month pay"). Each employee gets
(basic salary earned in the year) / 12 under PD 851, taken from FINALIZED regular runs that END in that year:
BASIC earnings minus ABSENCE and LATE deductions. Allowances, bonuses and other manual lines are excluded, and
people who joined or left mid-year are pro-rated automatically. It follows the same draft -> finalize -> lock flow,
and employees see it under My Payslips once finalized.

- It refuses to run while draft regular runs for that year exist, so the figures are complete.
- Basic pay earned outside the system (e.g. before the HRIS) can be added per payslip; one twelfth is added.
- Due by December 24 by law. Nothing is withheld: 13th month and other benefits are tax-exempt up to PHP 90,000
  combined; amounts above that are flagged for your accountant, not taxed automatically.
- If a regular run was created with absence/late deductions switched off, the 13th month uses the full basic pay for it.
