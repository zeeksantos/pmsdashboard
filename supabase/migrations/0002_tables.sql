-- Shared trigger: keep updated_at current on every UPDATE
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles (users/roles) — one row per auth.users row, created via trigger
-- (see 0005_profile_provisioning.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'front_desk',
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- units — room/unit inventory. Everything else references this.
-- ─────────────────────────────────────────────────────────────────────────
create table units (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  unit_type     text not null,
  max_capacity  integer not null check (max_capacity > 0),
  nightly_rate  numeric(12, 2) not null check (nightly_rate >= 0),
  amenities     text[] not null default '{}',
  status        unit_status not null default 'AVAILABLE',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger units_set_updated_at
  before update on units
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- guests — centralized guest directory. Stay history / spend are derived
-- (see 0005_views.sql), not stored here.
-- ─────────────────────────────────────────────────────────────────────────
create table guests (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  phone       text,
  id_type     text,
  id_number   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger guests_set_updated_at
  before update on guests
  for each row execute function set_updated_at();

create index guests_full_name_idx on guests using gin (to_tsvector('simple', full_name));
create index guests_phone_idx on guests (phone);
create index guests_email_idx on guests (email);

-- ─────────────────────────────────────────────────────────────────────────
-- bookings — reservations against a unit + date range.
-- stay_range excludes overlapping active bookings on the same unit
-- (double-booking prevention at the database level, not just app code).
-- ─────────────────────────────────────────────────────────────────────────
create table bookings (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references units (id) on delete restrict,
  guest_id      uuid not null references guests (id) on delete restrict,
  check_in      date not null,
  check_out     date not null check (check_out > check_in),
  status        booking_status not null default 'PENDING',
  total_amount  numeric(12, 2) not null default 0 check (total_amount >= 0),
  notes         text,
  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  stay_range    daterange generated always as (daterange(check_in, check_out, '[)')) stored,
  -- Only PENDING / CONFIRMED / CHECKED_IN bookings block a unit's calendar.
  -- CANCELLED and CHECKED_OUT bookings no longer occupy the range.
  is_blocking   boolean generated always as (
    status in ('PENDING', 'CONFIRMED', 'CHECKED_IN')
  ) stored,
  exclude using gist (
    unit_id with =,
    stay_range with &&
  ) where (is_blocking)
);

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

create index bookings_unit_id_idx on bookings (unit_id);
create index bookings_guest_id_idx on bookings (guest_id);
create index bookings_status_idx on bookings (status);
create index bookings_stay_range_idx on bookings using gist (stay_range);

-- ─────────────────────────────────────────────────────────────────────────
-- payments — recorded against a booking, PH payment methods.
-- ─────────────────────────────────────────────────────────────────────────
create table payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings (id) on delete restrict,
  amount        numeric(12, 2) not null check (amount > 0),
  method        payment_method not null,
  reference_no  text,
  paid_at       timestamptz not null default now(),
  recorded_by   uuid references profiles (id),
  notes         text,
  created_at    timestamptz not null default now()
);

create index payments_booking_id_idx on payments (booking_id);

-- ─────────────────────────────────────────────────────────────────────────
-- housekeeping_tasks — task queue, typically created by the checkout
-- automation (Inngest) but can also be created manually.
-- ─────────────────────────────────────────────────────────────────────────
create table housekeeping_tasks (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references units (id) on delete cascade,
  booking_id    uuid references bookings (id) on delete set null,
  status        housekeeping_task_status not null default 'PENDING',
  assigned_to   uuid references profiles (id),
  notes         text,
  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index housekeeping_tasks_unit_id_idx on housekeeping_tasks (unit_id);
create index housekeeping_tasks_status_idx on housekeeping_tasks (status);

-- ─────────────────────────────────────────────────────────────────────────
-- maintenance_tickets — property issue tracking, manual or system-created.
-- ─────────────────────────────────────────────────────────────────────────
create table maintenance_tickets (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references units (id) on delete cascade,
  title         text not null,
  description   text,
  priority      maintenance_priority not null default 'MEDIUM',
  status        maintenance_status not null default 'OPEN',
  assigned_to   uuid references profiles (id),
  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create trigger maintenance_tickets_set_updated_at
  before update on maintenance_tickets
  for each row execute function set_updated_at();

create index maintenance_tickets_unit_id_idx on maintenance_tickets (unit_id);
create index maintenance_tickets_status_idx on maintenance_tickets (status);

-- ─────────────────────────────────────────────────────────────────────────
-- audit_logs — immutable log of every mutation across every module.
-- Populated by generic triggers (see 0003_audit.sql), never written to
-- directly by application code.
-- ─────────────────────────────────────────────────────────────────────────
create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles (id),
  user_role      user_role,
  action         audit_action not null,
  resource_type  text not null,
  resource_id    uuid,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index audit_logs_resource_idx on audit_logs (resource_type, resource_id);
create index audit_logs_created_at_idx on audit_logs (created_at desc);
