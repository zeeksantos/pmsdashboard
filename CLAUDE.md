@AGENTS.md

# Property Management System (PMS) Dashboard

A centralized web-based Property Management System for short-term rental / small hotel
operators in the Philippines. It replaces spreadsheets, paper logs, and Messenger
conversations with one connected system covering the full guest lifecycle:

```
BOOKING → GUEST → CHECK-IN → STAY → BILLING → PAYMENT → CHECK-OUT → HOUSEKEEPING → MAINTENANCE → REPORTING
```

The core value isn't any single screen — it's the automation between modules. Example:
when a guest checks out, the room status should automatically flip to DIRTY, which should
automatically create a housekeeping task, which when completed flips the room to READY for
the next booking. One event should trigger the next without staff manually updating
multiple screens.

## Tech stack

- Next.js (App Router) + TypeScript
- Supabase (PostgreSQL) for the database and auth
- Tailwind CSS for styling
- Vercel for hosting/deployment
- Inngest for background jobs / event-driven automation (powers the
  checkout → dirty → housekeeping-task chain)
- PayMongo or Xendit for payment processing later (not needed for MVP — payments are
  logged manually first)

## Core modules (build in this order)

1. **Units & Rates** — room/unit inventory: name, type, max capacity, nightly rate,
   amenities, current status (AVAILABLE / OCCUPIED / DIRTY / CLEANING / MAINTENANCE).
   Build this first — everything else references it.
2. **Guests** — centralized guest directory: name, contact info, ID/verification, stay
   history, spending summary. Search by name/phone/email/ID.
3. **Bookings** — create/manage reservations against a unit and date range. Must prevent
   double-booking (check for date-range overlap against the same unit before allowing a
   new reservation). Track status: CONFIRMED / CHECKED_IN / CHECKED_OUT / PENDING /
   CANCELLED. Track total amount and running balance.
4. **Calendar** — visual occupancy view (daily/weekly/monthly toggle) showing which units
   are booked on which dates, pulling from the same Bookings data — not a separate view
   with its own query.
5. **Check-In / Check-Out** — structured workflow: select a reservation, verify guest,
   check in (unit → OCCUPIED). On check-out: calculate final balance, generate a receipt,
   flip unit → DIRTY, and auto-create a housekeeping task (implemented as an actual event,
   not a manual follow-up step).
6. **Billing & Payments** — itemized bills per booking, payments recorded against PH
   methods (GCash, Maya, Cash, Bank Transfer, Card), running unpaid balance per
   guest/booking.
7. **Housekeeping** — task queue driven by the checkout automation above, plus a
   room-status board: DIRTY → CLEANING → CLEAN → READY. Completing a task updates the
   unit's status, visible immediately on Units & Rates and Calendar.
8. **Maintenance** — trackable tickets for property issues: priority, description,
   assigned technician, status. Can be created manually (not just system-triggered).
9. **Notifications** — a feed reflecting real events across the modules above (booking
   created, payment due, check-in today, housekeeping needed, maintenance urgent) — not a
   separate hardcoded list.
10. **Audit Logs** — immutable log of every mutation: user, role, action, resource,
    timestamp, details. Every write from every module above produces an audit entry.
11. **Dashboard & Reports** — today's check-ins/check-outs, current guests,
    available/occupied rooms, today's revenue, pending payments, rooms needing cleaning,
    open maintenance tickets, occupancy rate, weekly revenue trend.

## Critical requirement — read before touching the dashboard

Every number on the Dashboard must be a live aggregate query against the same tables the
list/detail pages use — never a separate mock dataset or a disconnected calculation. If
the dashboard says "5 current guests" and "2 rooms needing cleaning," the Guests page and
Housekeeping queue must be able to show exactly those 5 guests and those 2 rooms. If a
booking or payment gets logged to Audit Logs, the corresponding Booking/Payment record
must actually exist and be queryable from the Bookings/Billing pages — the audit log is a
record of the mutation, not a substitute for it.

Concretely: after implementing check-in/check-out/payment flows, manually verify (or write
an integration test) that creating a booking → shows up in Bookings list → shows up on
Calendar → is reflected in Dashboard's check-in count → produces a matching Audit Log
entry, all from the same underlying row.

## Roles & access

- **Owner/Admin** — full visibility across everything.
- **Manager** — full operational access (no system/billing config).
- **Front Desk** — Bookings, Guests, Check-In/Out, Billing.
- **Housekeeping** — Housekeeping module and room status only.
- **Maintenance** — Maintenance tickets only.

Each role should only see nav items and data relevant to them.

## PH market specifics

- Currency: ₱ (Philippine Peso), formatted with thousands separators
- Timezone: Asia/Manila (UTC+8)
- Payment methods: GCash, Maya, Cash, Bank Transfer, Card

## Design direction

Dark theme (navy/near-black background), left sidebar nav with icons, KPI summary cards
across the top of the dashboard, card-based content areas, blue as the primary accent
color. Responsive — usable on desktop, tablet, and mobile (housekeeping/maintenance staff
will be on phones, not desks). PWA-installable is a nice-to-have, not MVP-critical.

## How to work on this project

- Build incrementally, module by module, in the order listed above. Don't scaffold all 11
  modules in one shot.
- The data model (units, guests, bookings, payments, housekeeping tasks, maintenance
  tickets, audit log, users/roles) is set up before any UI is built.
- After each module, the user is told what to manually test before moving to the next one.
- Ask clarifying questions about business rules (e.g. how partial payments affect booking
  status, whether cancellations refund automatically) rather than guessing.

## Project status

No Supabase project is connected yet — schema lives in `supabase/migrations/` as SQL, and
the app reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` from `.env.local` (see `.env.local.example`). Until those are
set, the app cannot actually query data — apply the migrations to a real Supabase project
and fill in `.env.local` before testing any module end-to-end.
