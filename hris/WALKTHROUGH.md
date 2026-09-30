# Z-Fast HRIS: full walkthrough checklist

Work top to bottom. Tick each box as you go. Every step says what you should **see**. If what you see
is different, stop, note the step number, and send it to me (see Part 15).

**Time needed:** about 2 to 3 hours the first time.
**You need:** a Supabase account, a computer with Node.js 20+ (or a Vercel account), and one email inbox
you can read (Gmail works best).

**Tip:** each person you sign in as needs their own login session. Use one normal browser window plus one
private/incognito window, or two different browsers, and sign out before switching roles in the same window.

---

## Part 0: Set up (do this once)

### 0.1 Create the Supabase project
- [ ] Sign in at supabase.com, click **New project**, name it `zfast-hris`, region **Southeast Asia (Singapore)**,
      set a database password and save it somewhere safe.
- [ ] Wait until the project says it is ready (about 2 minutes).

### 0.2 Run the 9 database files, in order
For each file below: open it from the `hris/supabase/migrations/` folder, select everything and copy it,
then in Supabase go to **SQL Editor → New query**, paste, click **Run**.

**Paste the file's contents, not its file name.** Each one should end with **"Success. No rows returned"**.

- [ ] `0001_enums_and_tables.sql`
- [ ] `0002_functions_audit_rls.sql`
- [ ] `0003_link_login_and_roles.sql`
- [ ] `0004_salary_constraints.sql`
- [ ] `0005_employee_documents_storage.sql`
- [ ] `0006_leave.sql`
- [ ] `0007_employee_self_service.sql`
- [ ] `0008_payroll.sql`
- [ ] `0009_thirteenth_month.sql`

Run each file **once**. If one fails halfway, send me the error before running anything else, because
re-running a half-applied file causes "already exists" errors.

### 0.3 Check that everything was created
- [ ] Run this in a new query:

```sql
select 'tables' as what, count(*) as found, 16 as expected
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
union all select 'policies', count(*), 29 from pg_policies where schemaname = 'public'
union all select 'audit triggers', count(*), 16 from pg_trigger where tgname like 'audit_%'
union all select 'functions', count(*), 15 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('clock_in','clock_out','link_employee_login','set_user_role',
  'request_leave','decide_leave','cancel_leave','leave_balances','employees_on_leave','preview_leave_days',
  'update_my_contact','payroll_inputs','finalize_payroll_run','reopen_payroll_run','thirteenth_month_basis')
union all select 'documents bucket', count(*), 1 from storage.buckets where id = 'employee-documents'
union all select 'departments', count(*), 5 from departments
union all select 'leave types', count(*), 4 from leave_types;
```

- [ ] **See:** the `found` and `expected` columns match on every row. (If you reused an older project that
      already had its own tables or policies, the counts can be higher. That's fine as long as none are lower.)

### 0.4 Make the reset-password email include the code
- [ ] In Supabase go to **Authentication → Email Templates → Reset Password**.
- [ ] Replace the subject with `Your Z-Fast HRIS password reset code` and the body with:

```html
<h2>Reset your password</h2>
<p>Your code is: <b>{{ .Token }}</b></p>
<p>It expires in 1 hour. If you didn't ask for this, ignore this email.</p>
```

- [ ] Click **Save**.

### 0.5 Get your keys and start the app
- [ ] In Supabase go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
      **Do not use the `service_role` key anywhere in this app.** It is not needed.

**Option A: on your computer**
- [ ] In the `hris` folder, copy `.env.local.example` to `.env.local` and paste the two values in.
- [ ] Run `npm install`, then `npm run dev`.
- [ ] Open http://localhost:3000. **See:** the Z-Fast HRIS sign-in page.

**Option B: on Vercel** (needed to test on a phone, and for staff to use it later)
- [ ] In Vercel, import the GitHub repo, set **Root Directory** to `hris`, and add the two environment
      variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Deploy.
- [ ] Open the deployed address. **See:** the sign-in page.

### 0.6 Create the six test logins and test data
- [ ] In Supabase go to **Authentication → Users → Add user → Create new user**. Create these six, all with
      **Auto Confirm User** ticked and the same password (for example `Test-Pass-123`).
      Replace `YOU` with your Gmail name (e.g. `maria` gives `maria+owner@gmail.com`). Every one of these
      arrives in your single inbox.

| Login | Will be |
|---|---|
| `YOU+owner@gmail.com` | Owner |
| `YOU+hr@gmail.com` | HR |
| `YOU+finance@gmail.com` | Finance |
| `YOU+manager@gmail.com` | Manager |
| `YOU+emp1@gmail.com` | Employee (Ella) |
| `YOU+emp2@gmail.com` | Employee (Eli) |

- [ ] Open `hris/supabase/test_data.sql`. Replace every `YOU` with your Gmail name, copy all of it, paste it
      into a new SQL query, and Run.
- [ ] **See:** a table of six people (TEST-001 to TEST-006) with roles and who reports to whom. Ella and Eli
      report to Marco. Everyone else reports to Olivia.
- [ ] If it says some logins don't exist, create them and run again. Nothing was saved. It is safe to run twice.

---

## Part 1: Sign in and out (Owner)

- [ ] Sign in as `YOU+owner@gmail.com`. **See:** the Home page saying "Hello, Olivia Owner", and a left menu.
- [ ] Sign out (bottom of the menu). **See:** the sign-in page.
- [ ] Try a wrong password. **See:** an error, and you stay on the sign-in page.
- [ ] While signed out, type `/employees` after the address. **See:** you are sent to the sign-in page.

## Part 2: Who sees what (all roles)

Sign in as each person and check the **left menu shows exactly these items** (order may vary).

| Sign in as | Menu items |
|---|---|
| Ella or Eli (employee) | Home, Time Clock, My Attendance, My Profile, My Account, Leave, My Payslips |
| Marco (manager) | the employee items, plus **Leave Approvals, Employees, Org Chart, Team Attendance** |
| Hannah (HR) | same as Marco |
| Felix (finance) | the employee items, plus **Employees, Org Chart, Salaries, Payroll** (no Leave Approvals, no Team Attendance) |
| Olivia (owner) | everything, including **Audit Log** |

- [ ] Employee menu is correct.
- [ ] Manager menu is correct.
- [ ] HR menu is correct.
- [ ] Finance menu is correct.
- [ ] Owner menu is correct.

**Blocked pages.** Type each address after your site's address. **See "not found" every time you should be blocked:**

| Address | Ella/Eli | Marco | Hannah | Felix | Olivia |
|---|---|---|---|---|---|
| `/employees` | blocked | ok | ok | ok | ok |
| `/salaries` | blocked | blocked | blocked | ok | ok |
| `/payroll` | blocked | blocked | blocked | ok | ok |
| `/team-attendance` | blocked | ok | ok | blocked | ok |
| `/leave/approvals` | blocked | ok | ok | blocked | ok |
| `/leave/settings` | blocked | blocked | ok | blocked | ok |
| `/audit-log` | blocked | blocked | blocked | blocked | ok |

- [ ] Every "blocked" cell above really showed "not found".

## Part 3: Time in and time out (Ella, then Marco and Hannah)

**Best done on a weekday during the working day (9:00 to 18:00 Manila time).** On a weekend clock-in works
but lateness isn't calculated, because nobody is scheduled.

- [ ] Sign in as **Ella**. Home shows "Your day" with no times yet.
- [ ] Open **Time Clock**. Click **Time In**. Your browser asks for location: click **Allow**.
- [ ] **See:** the Time in time appears, in Manila time. If it's more than 15 minutes after 9:00, it also
      says "Late by N min". The Time In button is gone.
- [ ] Reload the page. **See:** the time is still there.
- [ ] Click **Time Out**. **See:** "You're done for today."
- [ ] Open **My Attendance**. **See:** today with In, Out, and Late/Undertime minutes.
- [ ] **Location check:** sign in as **Eli** and click Time In, but this time click **Block** on the location
      question. **See:** a message that location is required. Allow it and try again.
- [ ] As **Eli**, stay timed in and don't time out. That way the dashboard in Part 8 shows two people clocked in.

**Grace period check (optional):** as Hannah, open **Employees → Ella → Edit** and change her shift start to
15 minutes **before** now. Time in as Ella: **See:** not late. Change the start to 30 minutes before now
(delete today's row first, or use a different day): **See:** "Late by 30 min".

## Part 4: Team attendance (Marco, Hannah, Olivia)

- [ ] Sign in as **Marco**. Open **Team Attendance**. **See:** today's date and a row each for Ella and Eli
      with in-times.
- [ ] Click a **Map** link. **See:** a map opens at the place you timed in from.
- [ ] Change the date to yesterday. **See:** "No attendance for this date" (or that day's rows).
- [ ] Sign in as Ella and try `/team-attendance`. **See:** not found (already covered in Part 2).

## Part 5: Employee records (Hannah, HR)

- [ ] Sign in as **Hannah**. Open **Employees**. **See:** all six test people.
- [ ] Search "Ella". **See:** one row. Set the department filter to Marketing. **See:** Marco, Ella, Eli.
- [ ] Click **Add employee**. **See:** a suggested employee number. Fill in name "Test Newhire",
      department HR, position "Recruiter" (a new title is fine), **Reports to** Hannah, type **Contractual**,
      date hired today. **See:** a "Contract end date" box appears. Set it to 10 days from now.
- [ ] Fill in the biodata fields (birthdate, phone, address, emergency contact, SSS and so on) and set the
      shift to 09:00 to 18:00 Monday to Friday. Click **Add employee**.
- [ ] **See:** the new profile with everything you entered.
- [ ] Try saving with the employee number of an existing person. **See:** "already in use".
- [ ] Open **Org Chart**. **See:** Olivia at the top, Marco, Hannah and Felix under her, Ella and Eli under
      Marco, Test Newhire under Hannah.
- [ ] Open Ella's profile → **Edit** → set her **Status** to On leave → Save. Open the org chart.
      **See:** she has disappeared (the chart shows active people only). Set her back to Active.
- [ ] **Login access (optional):** create a seventh login `YOU+new@gmail.com` in Supabase. Open Test
      Newhire → Edit → **Login access**, type that email, click **Link login**. **See:** "Login linked."
      The profile now says Login: Linked.

### Documents
- [ ] On Ella's profile, upload a small PDF as type **Contract**. **See:** it appears in the list with size
      and time.
- [ ] Click the file name. **See:** it opens.
- [ ] Try a file over 10 MB, then a `.exe`. **See:** a clear rejection each time.
- [ ] Sign in as **Ella**, open **My Profile**. **See:** her contract is listed and opens. There is no
      Upload or Delete button.
- [ ] As Hannah, delete a document. **See:** a confirmation, then it disappears.

### Privacy checks
- [ ] Sign in as **Marco**. Open Ella's profile. **See:** work info and schedule, and a note that biodata is
      only visible to HR, admin, owner and the employee. No SSS, address, or documents.
- [ ] Sign in as **Felix**. Same result. He sees no biodata.
- [ ] As Hannah, copy Marco's profile address. Paste it while signed in as **Ella**. **See:** not found.

## Part 6: Employee self-service (Ella)

- [ ] Sign in as **Ella**, open **My Account**. Enter a phone number, address, city, province and an emergency
      contact. Click **Save changes**. **See:** "Saved."
- [ ] Reload. **See:** the values are still there.
- [ ] Put `abc` in personal email and save. **See:** "That email address doesn't look right."
- [ ] Look at the page: **See:** there is no field for SSS, TIN, name, birthdate or marital status, and a note
      to ask HR for those.
- [ ] Sign in as **Hannah**, open Ella → Edit. **See:** Ella's new phone and address, with SSS unchanged.
- [ ] **Change password:** as Ella, enter a wrong current password. **See:** "Your current password is
      incorrect." Then use the right one with a new password of at least 8 characters. **See:**
      "Password changed." Sign out and back in with the new password. Change it back to `Test-Pass-123`.

## Part 7: Leave

**Use future weekdays.** "Next Monday" means the coming Monday.

### As Ella
- [ ] Open **Leave**. **See:** balance cards. Vacation 5 left, Sick 5, Emergency 3, Unpaid with "No limit".
- [ ] Request **Vacation Leave**, next Monday to next Tuesday. **See:** "This will use 2 days of your
      scheduled working days." Click **Request leave**.
- [ ] **See:** the request under My requests as **pending**, and Vacation now shows **3 left**, 2 pending.
- [ ] Pick a **Saturday** only. **See:** a red "No working days in that range" and it won't submit.
- [ ] Request Vacation for the Wednesday to the next Tuesday (5 days). **See:** an error like "Not enough
      Vacation Leave balance: 3 day(s) left".
- [ ] Request Sick Leave that overlaps your Vacation dates. **See:** an "overlaps" error.
- [ ] Tick **Half day** and request Sick Leave for a free Thursday. **See:** "0.5 days". Submit, then click
      **Cancel** on it. **See:** it becomes cancelled and the balance goes back.

### As Marco (Ella's manager)
- [ ] Open **Leave Approvals**. **See:** Ella's vacation request, showing what balance she has.
- [ ] Type a note and click **Approve**. **See:** it moves to Recent decisions as approved.
- [ ] Open Marco's own **Leave** and request one vacation day for **next Wednesday**. Then open **Leave Approvals**.
      **See:** your own request is **not** in your queue (someone above you decides it).
- [ ] Sign in as **Hannah** (HR). **See:** Marco's request in her queue. **Reject** it with a note.
      **See:** Marco sees it as rejected, with the note.

### As Hannah: settings
- [ ] Open **Leave → Leave settings**. Change Vacation Leave to 7 days and Save. **See:** Ella's Vacation
      balance shows 5 left (7 minus 2 approved).
- [ ] In "Adjust one employee's allowance", give Eli 10 vacation days for this year. **See:** Eli's Vacation
      shows 10.
- [ ] Add a new type "Maternity Leave" with 105 days, Capped. **See:** it appears in Ella's request list.

### Leave on the dashboard (do this on a weekday, before 6 PM)
- [ ] As **Marco** (who hasn't timed in today), request Vacation Leave for **today**. Sign in as **Olivia** and
      approve it under **Leave Approvals**. (Marco's own manager is Olivia, and he can't approve himself.)
- [ ] As **Olivia**, open **Home**. **See:** "On approved leave" is 1, and Marco is listed under "On approved
      leave today". If it's past 9:15 AM, Marco is **not** listed under "Not in yet", while other people
      who haven't timed in (Hannah, Felix and so on) are.

## Part 8: Dashboard numbers (Olivia, then Hannah, Marco, Felix)

Every number should match the page it links to.

- [ ] As **Olivia**, open Home. **See** these sections: Today's attendance, Headcount, Needs attention,
      Payroll readiness.
- [ ] **Active employees** equals the number of rows when you click it (Employees filtered to Active).
      With the Part 5 employee added, that is 7. Click **Contractual**: **See:** 1 (Test Newhire).
- [ ] **By department:** Admin 1, Finance 1, HR 2, Marketing 3.
- [ ] **Scheduled today** matches the working people today (weekday: 7). **Clocked in** equals the number
      of people who timed in (Ella, Eli, so 2). Click it. **See:** the same people on Team Attendance.
- [ ] **Not in yet (past grace)** on a weekday after 9:15 AM lists the people scheduled who haven't timed
      in, and doesn't include anyone on approved leave. (Do this check again after the leave step in Part 7.)
- [ ] **Needs attention**: "Contracts ending" lists Test Newhire "in 10d". "Active with no biodata" lists
      people whose biodata was never filled in by HR. "Active with no login linked" lists Test Newhire
      (unless you linked it in Part 5).
- [ ] **Birthdays this month** lists anyone whose birthdate month is this month.
- [ ] Sign in as **Felix**. Home shows Headcount and **Payroll readiness** (Active with no salary set = 0,
      or 1 for Test Newhire who has no salary yet), and **no** HR or attendance sections.
- [ ] Sign in as **Ella**. Home shows only "Your day".

## Part 9: Salaries (Felix, finance)

- [ ] Sign in as **Felix**. Open **Salaries**. **See:** the six test people with monthly rates. The
      **Monthly payroll** card is **₱198,000.00** for the six (60,000 + 30,000 + 30,000 + 40,000 + 20,000
      + 18,000; Test Newhire adds nothing until a salary is set).
- [ ] The card **Active with no salary set** is 1 (Test Newhire). Click that person and add a monthly rate of
      ₱25,000 effective today. **See:** it shows **Current**, and the payroll card rises to ₱223,000.00.
- [ ] Add another entry for Ella of ₱22,000 with a **future** date. **See:** it is marked **Scheduled** and
      her current rate does not change.
- [ ] Try adding a second entry on the same date. **See:** a clear "already a salary with that date" message.
- [ ] Delete the future entry. **See:** a confirmation, then it disappears.
- [ ] Open Ella's **profile** as Felix. **See:** a **Salary** button, and no biodata.
- [ ] Sign in as **Hannah**, **Marco** and **Ella**: none of them has a Salaries menu, and `/salaries` shows
      "not found" (already checked in Part 2).

## Part 10: Payroll (Felix)

### 10.1 Add known attendance to check the numbers
Clock-ins can't be back-dated in the app, so use a script.

- [ ] In SQL Editor, run `hris/supabase/test_attendance.sql` (open the file, copy all, paste, Run).
- [ ] **See:** a table with 11 days logged for TEST-001 to TEST-005 and 9 for TEST-006 (Eli, 20 minutes late).

### 10.2 Create a draft run
- [ ] As **Felix**, open **Payroll**. Under **New payroll run** enter: **Period start** `2026-01-01`,
      **Period end** `2026-01-15`, **Pay date** `2026-01-15`, **2 (semi-monthly)**, all four boxes ticked.
- [ ] Click **Create draft run**. **See:** the run page saying **Draft: review before finalizing**.
- [ ] **See** these totals: **Gross ₱99,000.00**, **Deductions ₱14,536.66**, **Net ₱84,463.34**,
      **Employer contributions ₱11,475.00**. These cover the six test people only. Test Newhire joined later than
      January, so a yellow "Not included" note lists them. That is correct.
- [ ] **See** these per-person amounts:

| Person | Gross | Net |
|---|---|---|
| Olivia (60,000) | 30,000.00 | 25,015.83 |
| Hannah (30,000) | 15,000.00 | 13,271.25 |
| Felix (30,000) | 15,000.00 | 13,271.25 |
| Marco (40,000) | 20,000.00 | 17,215.83 |
| Ella (20,000) | 10,000.00 | 9,150.00 |
| Eli (18,000) | 9,000.00 | 6,539.18 |

- [ ] Open **Eli's** payslip. **See** these lines. Earnings: Basic pay 9,000.00. Deductions: Absences
      (2 days) 1,655.17, Late / undertime (20 min) 30.65, SSS 450.00, PhilHealth 225.00, Pag-IBIG 100.00
      (no tax line, because his pay is under the tax threshold). Employer section: SSS 900, PhilHealth 225,
      Pag-IBIG 100. Net **6,539.18**.
- [ ] Open **Olivia's** payslip. **See:** SSS 875.00, PhilHealth 750.00, Pag-IBIG 100.00, **Withholding tax
      3,259.17**.
- [ ] **Compare by hand:** pick one person and check the numbers against your own calculation or your
      accountant's payroll sheet. This is the most important check in this whole document.

### 10.3 Adjust the draft
- [ ] On **Ella's** payslip, add an **Earning** "Allowance" of 500. **See:** it appears marked "manual" and
      Net becomes **9,650.00**.
- [ ] Remove Eli's **SSS** line (confirm). **See:** his net rises by 450.00 to 6,989.18.
- [ ] Try creating another run for exactly Jan 1 to Jan 15. **See:** it says a run already exists.
- [ ] Click **Delete draft** and confirm, then create the same run again to reset the numbers.
- [ ] Click **Download CSV**. **See:** a file with a row per person: employee no, name, gross, deductions, net.

### 10.4 The "never pay negative" check
- [ ] Create another run for `2026-01-16` to `2026-01-31`, pay date `2026-01-31`, everything ticked.
      Nobody has attendance then, so everyone is absent.
- [ ] **See:** each person's **Absences** deduction is **exactly their basic pay** and never more (Ella:
      basic 10,000.00, absences 10,000.00), and a red **Negative net pay** box lists people whose
      contributions leave them under zero.
- [ ] **Delete this draft.** (Drafts block the 13th month calculation later.)

### 10.5 Finalize and lock
- [ ] Sign in as **Ella** first. Open **My Payslips**. **See:** "No payslips yet." (Draft runs are invisible
      to employees.)
- [ ] As Felix, on the Jan 1 to 15 run, click **Finalize run** and confirm. **See:** it says Finalized with a
      date and time, and the buttons for removing lines and deleting are gone.
- [ ] Sign in as **Ella**. Open **My Payslips**. **See:** Jan 1 – Jan 15, 2026 with net **9,150.00**. Open it. **See:** earnings and deductions, no
      "Employer contributions" section, and a **Print** button. Click Print. **See:** a clean page without
      the menu.
- [ ] Sign in as **Eli**. **See:** only his own payslip.
- [ ] As Felix, open the finalized payslip. **See:** there is no way to edit it.
- [ ] Sign in as **Hannah** or **Marco**. Try `/payroll`. **See:** not found.
- [ ] As **Olivia** (or an admin), open the run and click **Reopen run**. **See:** it goes back to Draft, and
      Ella's My Payslips is empty again. Finalize it again.
- [ ] Sign in as Felix: **See:** there is **no** Reopen button for finance.

## Part 11: 13th month pay (Felix)

- [ ] As **Felix**, with the Jan 1 to 15 run finalized and no other draft runs, open **Payroll** and find
      **13th month pay**. Set **Year** to `2026` and keep pay date `2026-12-20`. Click
      **Create 13th month draft**.
- [ ] **See** these amounts (basic earned in the year ÷ 12):

| Person | 13th month |
|---|---|
| Olivia | 2,500.00 |
| Hannah | 1,250.00 |
| Felix | 1,250.00 |
| Marco | 1,666.67 |
| Ella | 833.33 |
| Eli | 609.52 |

- [ ] Open **Eli's** payslip. **See:** Basic salary paid 9,000.00, less absences 1,655.17, less late 30.65,
      basic earned 7,314.18, one payroll run counted, and 609.52 = 7,314.18 ÷ 12.
- [ ] On **Ella's** payslip, add **Basic pay earned outside this system** of 120,000. **See:** ₱10,000.00
      is added, so her 13th month is 10,833.33.
- [ ] **Guard check:** create a regular draft run for Feb 1 to Feb 15, 2026. Try creating the 13th month
      again. **See:** it refuses because a draft exists. Delete the February draft.
- [ ] Finalize the 13th month. Try creating another 13th month for 2026. **See:** it says one already exists.
- [ ] Sign in as **Ella**. Open **My Payslips**. **See:** "13th month pay 2026" as well as the January
      payslip.

## Part 12: Audit log (Olivia)

- [ ] Sign in as **Olivia**. Open **Audit Log**. **See:** a long list of entries with when (Manila time), who
      (names), action, record type, and details.
- [ ] Filter **Record type: Salary**. **See:** the salary changes from Part 9, including the deletion, in
      **Deleted**.
- [ ] Filter **Employee** and **Updated**. Expand "fields changed" on Ella's status change. **See:** a line
      like `status: ACTIVE → ON_LEAVE`.
- [ ] Filter **Leave request**, **Payroll run**, **Payslip**. **See:** entries from Parts 7, 10 and 11.
- [ ] Filter by a date with no changes. **See:** "No log entries match."
- [ ] **See:** there is no way to edit or delete an entry.
- [ ] Sign in as **Hannah** and try `/audit-log`. **See:** not found.

## Part 13: Forgot password

- [ ] Sign out. On the sign-in page click **Forgot your password?** **See:** the reset page.
- [ ] Enter `YOU+emp2@gmail.com`, click **Send me a code**. **See:** "If … has an account, we've emailed a code."
- [ ] Check your inbox (and spam). **See:** an email with a numeric code. **If there is no code in the email,
      redo step 0.4.** If nothing arrives after a few minutes and a second try, wait an hour, because
      Supabase's built-in email sender is limited to a few emails an hour.
- [ ] Enter the code and a new password. **See:** you land on Home, signed in as Eli.
- [ ] Sign out. Try the **same code** again. **See:** "wrong or has expired."
- [ ] Ask for a code for an email that doesn't exist. **See:** the **same** "we've emailed a code" message.
- [ ] Try mismatched passwords, and a password of 5 characters. **See:** a clear error each time.
- [ ] Sign in as Eli with the new password. Set it back via My Account if you want.

## Part 14: Phone check

- [ ] Open the site on your phone (the Vercel address, not localhost). Sign in as **Ella**.
- [ ] **See:** the menu is a bar across the top that scrolls sideways, and pages fit the screen.
- [ ] Time in. **See:** your phone asks for location permission, then the time appears.
- [ ] Open **Leave** and request a day. **See:** the form is usable with a phone keyboard.
- [ ] Open a payslip, and the **Team Attendance** page as Marco. **See:** tables scroll sideways instead of
      breaking the page.

---

## Part 15: If something goes wrong

Send me:
1. **The step number** (for example "Part 10.2, third box").
2. **Who you were signed in as**, and the page address.
3. **What you expected, and what you saw.** A screenshot is best. Include any red text exactly.
4. **If a page was blank or said "something went wrong":** the last lines from the terminal (if running
   on your computer) or Vercel's **Logs** tab, and Supabase **Logs → Postgres** for the same minute.

---

## Before real use

**Do this after the walkthrough passes.**

### Data and accounts
- [ ] **Use a fresh Supabase project for real data.** Run the nine files again on a new project. The audit log
      is permanent by design, so test entries can't be removed from the test project. Keep the test project
      as a practice area.
- [ ] Turn on **two-step verification** on your Supabase, GitHub and Vercel accounts. They can reach everyone's
      salary and government ID numbers.
- [ ] Give the **Owner** and **Admin** roles to as few people as possible.
- [ ] Set up **your own email sender** (Supabase → Authentication → SMTP Settings), so password codes always
      arrive. Resend or Gmail both work.
- [ ] Check your Supabase plan's **backup** options. This system holds payroll and personal data, so know how
      you would recover it.
- [ ] Get employees' agreement to how their personal data is used. This system stores sensitive personal
      information, which the Data Privacy Act covers.

### Payroll and leave policy
- [ ] **Have your accountant check the government rates** (SSS, PhilHealth, Pag-IBIG, income tax) against the
      current tables. If any are out of date, send me the new values.
- [ ] Confirm the payroll rules match your policy: how a daily rate is worked out (monthly × 12 ÷ working days a
      year), the 1-hour unpaid break for hourly staff, and whether absences and lateness are deducted.
- [ ] Set your real **leave types and days** in Leave settings, and add any statutory leaves you offer.
- [ ] Decide who **approves leave** for each person, and set **Reports to** accordingly.

### Rolling out
- [ ] For each real employee, create a login, add them in Employees (with schedule and salary), link the login,
      and set the role. Ask them to change their password on first sign-in (My Account).

### What the system doesn't do yet
- **Overtime and holiday premiums**, and any holiday list. On a public holiday everyone scheduled will show as
  "Not in yet."
- **Final pay** for someone who resigns mid-period, and **loans** as a repayment schedule (use a manual
  adjustment on the payslip for now).
- **BIR / SSS / PhilHealth / Pag-IBIG filing files.**
- **Correcting a wrong clock-in** from the screen (needs SQL for now), **email or in-app notifications**, and
  two-step sign-in inside the app.
