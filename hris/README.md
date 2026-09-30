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
Run in order: 0001 (tables), 0002 (functions, audit, RLS), 0003 (link login + set role), 0004 (salary constraints), 0005 (document storage).
