-- Row Level Security. All access goes through Supabase auth; the anon key
-- alone grants nothing beyond what these policies allow.

alter table profiles enable row level security;
alter table units enable row level security;
alter table guests enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table housekeeping_tasks enable row level security;
alter table maintenance_tickets enable row level security;
alter table audit_logs enable row level security;

-- Helper: current caller's role, read once per statement.
create or replace function auth_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin_or_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth_role() in ('owner_admin', 'manager');
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — everyone can read their own row; admins manage everyone's.
-- Role changes are restricted to owner_admin (system config).
-- ─────────────────────────────────────────────────────────────────────────
create policy profiles_select_own on profiles
  for select using (id = auth.uid() or auth_role() = 'owner_admin');

create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

create policy profiles_admin_all on profiles
  for all using (auth_role() = 'owner_admin') with check (auth_role() = 'owner_admin');

-- ─────────────────────────────────────────────────────────────────────────
-- units — every operational role needs to see units; only admin/manager/
-- front_desk manage inventory & rates, housekeeping+maintenance can update
-- status as part of their workflow.
-- ─────────────────────────────────────────────────────────────────────────
create policy units_select_all on units
  for select using (auth_role() is not null);

create policy units_write_admin_manager_frontdesk on units
  for all
  using (auth_role() in ('owner_admin', 'manager', 'front_desk'))
  with check (auth_role() in ('owner_admin', 'manager', 'front_desk'));

create policy units_update_housekeeping on units
  for update
  using (auth_role() = 'housekeeping')
  with check (auth_role() = 'housekeeping');

create policy units_update_maintenance on units
  for update
  using (auth_role() = 'maintenance')
  with check (auth_role() = 'maintenance');

-- ─────────────────────────────────────────────────────────────────────────
-- guests — admin/manager/front_desk only.
-- ─────────────────────────────────────────────────────────────────────────
create policy guests_all_frontdesk on guests
  for all
  using (auth_role() in ('owner_admin', 'manager', 'front_desk'))
  with check (auth_role() in ('owner_admin', 'manager', 'front_desk'));

-- ─────────────────────────────────────────────────────────────────────────
-- bookings — admin/manager/front_desk only.
-- ─────────────────────────────────────────────────────────────────────────
create policy bookings_all_frontdesk on bookings
  for all
  using (auth_role() in ('owner_admin', 'manager', 'front_desk'))
  with check (auth_role() in ('owner_admin', 'manager', 'front_desk'));

-- ─────────────────────────────────────────────────────────────────────────
-- payments — admin/manager/front_desk only.
-- ─────────────────────────────────────────────────────────────────────────
create policy payments_all_frontdesk on payments
  for all
  using (auth_role() in ('owner_admin', 'manager', 'front_desk'))
  with check (auth_role() in ('owner_admin', 'manager', 'front_desk'));

-- ─────────────────────────────────────────────────────────────────────────
-- housekeeping_tasks — admin/manager see & manage everything; housekeeping
-- role manages the queue.
-- ─────────────────────────────────────────────────────────────────────────
create policy housekeeping_tasks_admin_manager on housekeeping_tasks
  for all
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

create policy housekeeping_tasks_housekeeping on housekeeping_tasks
  for all
  using (auth_role() = 'housekeeping')
  with check (auth_role() = 'housekeeping');

-- ─────────────────────────────────────────────────────────────────────────
-- maintenance_tickets — admin/manager see & manage everything; maintenance
-- role manages tickets. Front desk can create tickets (reporting an issue)
-- but not resolve them.
-- ─────────────────────────────────────────────────────────────────────────
create policy maintenance_tickets_admin_manager on maintenance_tickets
  for all
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

create policy maintenance_tickets_maintenance on maintenance_tickets
  for all
  using (auth_role() = 'maintenance')
  with check (auth_role() = 'maintenance');

create policy maintenance_tickets_frontdesk_create on maintenance_tickets
  for insert
  with check (auth_role() = 'front_desk');

create policy maintenance_tickets_frontdesk_select on maintenance_tickets
  for select
  using (auth_role() = 'front_desk');

-- ─────────────────────────────────────────────────────────────────────────
-- audit_logs — read-only, admin (and manager, for visibility) only.
-- Inserts happen exclusively via the security-definer trigger function.
-- ─────────────────────────────────────────────────────────────────────────
create policy audit_logs_select_admin_manager on audit_logs
  for select using (is_admin_or_manager());
