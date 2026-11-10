-- ═════════════════════════════════════════════════════════════════════════
-- Portfolio Analytics — multi-tenant module sold to outside hosts and
-- property managers.
--
-- Tenancy: every customer gets a `workspaces` row. All analytics data hangs
-- off workspace_id and RLS only shows rows for workspaces you're a member of.
-- `workspaces` / `workspace_members` are deliberately not `an_`-prefixed:
-- they're meant to become the tenancy for the rest of the PMS later too.
--
-- Data comes in as channel CSV exports (Airbnb, Booking.com, Agoda),
-- normalised into an_transactions. Expenses, receipts, owners and branding
-- are entered in the app.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Keep analytics customers out of the PMS
-- ─────────────────────────────────────────────────────────────────────────

-- New sign-ups now default to analytics_only (no PMS access). PMS staff
-- accounts are promoted by hand, exactly as before (see supabase/README.md).
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'New User'),
    'analytics_only'
  );
  return new;
end;
$$;

-- These three policies previously allowed any signed-in role, which would
-- now include analytics customers.
drop policy if exists units_select_all on units;
create policy units_select_all on units
  for select using (auth_role() is not null and auth_role() <> 'analytics_only');

drop policy if exists unit_photos_select_all on unit_photos;
create policy unit_photos_select_all on unit_photos
  for select using (auth_role() is not null and auth_role() <> 'analytics_only');

drop policy if exists unit_photos_storage_select on storage.objects;
create policy unit_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'unit-photos'
    and auth_role() is not null
    and auth_role() <> 'analytics_only'
  );

-- Customer sign-ups shouldn't appear in the PMS audit log that PMS managers
-- can read.
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user uuid := auth.uid();
  acting_role user_role;
  row_id uuid;
  payload jsonb;
begin
  -- Nested ifs: plpgsql doesn't short-circuit, and other tables have no
  -- `role` column.
  if tg_table_name = 'profiles' then
    if tg_op = 'DELETE' then
      if old.role = 'analytics_only' then return old; end if;
    elsif new.role = 'analytics_only' and (tg_op = 'INSERT' or old.role = 'analytics_only') then
      return new;
    end if;
  end if;

  select role into acting_role from profiles where id = acting_user;

  if (tg_op = 'DELETE') then
    row_id := old.id;
    payload := jsonb_build_object('old', to_jsonb(old));
  elsif (tg_op = 'UPDATE') then
    row_id := new.id;
    payload := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    row_id := new.id;
    payload := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into audit_logs (user_id, user_role, action, resource_type, resource_id, details)
  values (acting_user, acting_role, tg_op::audit_action, tg_table_name, row_id, payload);

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tenancy: workspaces, members, invites, platform admins, licences
-- ─────────────────────────────────────────────────────────────────────────

-- Who runs the platform (Z-Fast). Add rows by hand in the SQL editor:
--   insert into an_platform_admins (user_id) values ('<your-user-id>');
create table an_platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table workspaces (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  -- 'host' = owns their units; 'manager' = manages units for owners and
  -- sends owner statements.
  kind             text not null default 'host' check (kind in ('host', 'manager')),
  -- White-label branding shown in the app and on owner statements.
  brand_name       text,
  brand_logo_path  text,
  brand_color      text check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  statement_footer text,
  base_currency    text not null default 'PHP',
  -- Licence: one-time fee buys a year; renewals extend access_until.
  trial_ends_at    date not null default (current_date + 14),
  access_until     date,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger workspaces_set_updated_at
  before update on workspaces
  for each row execute function set_updated_at();

create table workspace_members (
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on workspace_members (user_id);

create table workspace_invites (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  email         text not null check (email = lower(trim(email)) and email like '%@%'),
  role          text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (workspace_id, email)
);

-- Licence history: every activation / renewal the platform admin records.
create table an_license_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  kind          text not null check (kind in ('activated', 'renewed', 'trial_extended')),
  years         integer not null default 0 check (years >= 0),
  days          integer not null default 0 check (days >= 0),
  amount        numeric(12, 2) check (amount is null or amount >= 0),
  note          text,
  access_until  date,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index an_license_events_ws_idx on an_license_events (workspace_id, created_at desc);

-- ── helper functions (security definer so policies don't recurse) ────────

create or replace function an_is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from an_platform_admins where user_id = auth.uid());
$$;

create or replace function an_member_role(p_workspace uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from workspace_members
  where workspace_id = p_workspace and user_id = auth.uid();
$$;

create or replace function an_is_member(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select an_member_role(p_workspace) is not null;
$$;

-- Licence active = still in trial, or paid access hasn't lapsed.
create or replace function an_workspace_active(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspaces w
    where w.id = p_workspace
      and (
        w.trial_ends_at >= (now() at time zone 'Asia/Manila')::date
        or coalesce(w.access_until, '-infinity'::date) >= (now() at time zone 'Asia/Manila')::date
      )
  );
$$;

-- Owners and editors can change data, but only while the licence is active.
-- Expired workspaces stay readable so customers never lose their history.
create or replace function an_can_edit(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select an_member_role(p_workspace) in ('owner', 'editor')
     and an_workspace_active(p_workspace);
$$;

create or replace function an_is_ws_owner(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select an_member_role(p_workspace) = 'owner';
$$;

-- Storage paths are '<workspace_id>/...'; returns null for anything else.
create or replace function an_path_workspace(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

-- ── RLS for tenancy tables ───────────────────────────────────────────────

alter table an_platform_admins enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table an_license_events enable row level security;

create policy an_platform_admins_self on an_platform_admins
  for select using (user_id = auth.uid());

create policy workspaces_select on workspaces
  for select using (an_is_member(id) or an_is_platform_admin());

-- Owners can edit name/kind/branding only (column grants below); licence
-- columns are changed exclusively through an_record_license().
create policy workspaces_update_owner on workspaces
  for update using (an_is_ws_owner(id)) with check (an_is_ws_owner(id));

revoke update on workspaces from anon, authenticated;
grant update (name, kind, brand_name, brand_logo_path, brand_color, statement_footer)
  on workspaces to authenticated;
-- Inserts go through an_create_workspace(); nobody deletes from the app.
revoke insert, delete on workspaces from anon, authenticated;

create policy workspace_members_select on workspace_members
  for select using (an_is_member(workspace_id) or an_is_platform_admin());

create policy workspace_members_owner_update on workspace_members
  for update using (an_is_ws_owner(workspace_id) and user_id <> auth.uid())
  with check (an_is_ws_owner(workspace_id) and user_id <> auth.uid());

create policy workspace_members_owner_delete on workspace_members
  for delete using (an_is_ws_owner(workspace_id) and user_id <> auth.uid());

-- Members are only ever added by an_create_workspace / an_accept_invites.
revoke insert on workspace_members from anon, authenticated;

create policy workspace_invites_select on workspace_invites
  for select using (an_is_member(workspace_id));

create policy workspace_invites_owner_write on workspace_invites
  for all using (an_is_ws_owner(workspace_id)) with check (an_is_ws_owner(workspace_id));

create policy an_license_events_select on an_license_events
  for select using (an_is_ws_owner(workspace_id) or an_is_platform_admin());

revoke insert, update, delete on an_license_events from anon, authenticated;

-- Member e-mails for the settings page (auth.users isn't readable directly).
create or replace function an_workspace_member_list(p_workspace uuid)
returns table (user_id uuid, email text, full_name text, role text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select m.user_id, u.email::text, p.full_name, m.role, m.created_at
  from workspace_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.workspace_id = p_workspace
    and (an_is_member(p_workspace) or an_is_platform_admin())
  order by m.created_at;
$$;

-- ── RPCs ─────────────────────────────────────────────────────────────────

-- Self-serve sign-up: creates a workspace on a 14-day trial with the caller
-- as owner. One owned workspace per customer (platform admins excepted) so
-- trials can't be farmed.
create or replace function an_create_workspace(p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Workspace name is required';
  end if;
  if p_kind not in ('host', 'manager') then
    raise exception 'Invalid workspace type';
  end if;
  if not an_is_platform_admin() and exists (
    select 1 from workspace_members where user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'You already own a workspace';
  end if;

  insert into workspaces (name, kind, brand_name, created_by)
  values (trim(p_name), p_kind, trim(p_name), auth.uid())
  returning id into ws_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, auth.uid(), 'owner');

  return ws_id;
end;
$$;

grant execute on function an_create_workspace(text, text) to authenticated;

-- Joins every workspace that invited the caller's e-mail.
create or replace function an_accept_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text := lower((select email from auth.users where id = auth.uid()));
  joined integer;
begin
  if auth.uid() is null or my_email is null then
    return 0;
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  select i.workspace_id, auth.uid(), i.role
  from workspace_invites i
  where i.email = my_email
  on conflict (workspace_id, user_id) do nothing;
  get diagnostics joined = row_count;

  delete from workspace_invites where email = my_email;
  return joined;
end;
$$;

grant execute on function an_accept_invites() to authenticated;

-- Platform admin records a payment / renewal / trial extension.
create or replace function an_record_license(
  p_workspace uuid,
  p_kind text,
  p_years integer,
  p_days integer,
  p_amount numeric,
  p_note text
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  new_until date;
begin
  if not an_is_platform_admin() then
    raise exception 'Only platform admins can record licences';
  end if;
  if p_kind not in ('activated', 'renewed', 'trial_extended') then
    raise exception 'Invalid licence event';
  end if;

  if p_kind = 'trial_extended' then
    update workspaces
      set trial_ends_at = greatest(trial_ends_at, today) + greatest(coalesce(p_days, 0), 0)
      where id = p_workspace
      returning trial_ends_at into new_until;
  else
    update workspaces
      set access_until = greatest(coalesce(access_until, today), today)
        + make_interval(years => greatest(coalesce(p_years, 0), 0), days => greatest(coalesce(p_days, 0), 0))
      where id = p_workspace
      returning access_until into new_until;
  end if;

  if new_until is null then
    raise exception 'Workspace not found';
  end if;

  insert into an_license_events (workspace_id, kind, years, days, amount, note, access_until, created_by)
  values (p_workspace, p_kind, coalesce(p_years, 0), coalesce(p_days, 0), p_amount, p_note, new_until, auth.uid());

  return new_until;
end;
$$;

grant execute on function an_record_license(uuid, text, integer, integer, numeric, text) to authenticated;

-- Platform admin overview of every customer.
create or replace function an_admin_workspaces()
returns table (
  id uuid,
  name text,
  kind text,
  owner_email text,
  member_count integer,
  unit_count integer,
  transaction_count bigint,
  last_import_at timestamptz,
  trial_ends_at date,
  access_until date,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not an_is_platform_admin() then
    raise exception 'Only platform admins can list workspaces';
  end if;

  return query
  select
    w.id,
    w.name,
    w.kind,
    (select u.email::text from workspace_members m join auth.users u on u.id = m.user_id
      where m.workspace_id = w.id and m.role = 'owner' order by m.created_at limit 1),
    (select count(*)::integer from workspace_members m where m.workspace_id = w.id),
    (select count(*)::integer from an_units un where un.workspace_id = w.id),
    (select count(*) from an_transactions t where t.workspace_id = w.id),
    (select max(i.created_at) from an_imports i where i.workspace_id = w.id),
    w.trial_ends_at,
    w.access_until,
    w.created_at
  from workspaces w
  order by w.created_at desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Portfolio: owners, units, channel listings
-- ─────────────────────────────────────────────────────────────────────────

-- Property owners (manager workspaces). A host workspace can leave units
-- unassigned.
create table an_owners (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  email            text,
  -- Manager's commission, as % of the unit's net channel earnings.
  management_fee_pct numeric(5, 2) not null default 0
    check (management_fee_pct >= 0 and management_fee_pct <= 100),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger an_owners_set_updated_at
  before update on an_owners
  for each row execute function set_updated_at();

create index an_owners_ws_idx on an_owners (workspace_id);

-- Physical units. One unit can carry several channel listings (e.g. a
-- short-stay and a long-term listing on Airbnb, plus Booking.com).
create table an_units (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  owner_id      uuid references an_owners (id) on delete set null,
  name          text not null check (length(trim(name)) > 0),
  building      text,
  area          text,
  -- Occupancy is measured from this date (defaults to the first stay seen).
  active_from   date,
  archived      boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger an_units_set_updated_at
  before update on an_units
  for each row execute function set_updated_at();

create index an_units_ws_idx on an_units (workspace_id);

create table an_listings (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces (id) on delete cascade,
  channel        text not null check (channel in ('airbnb', 'booking', 'agoda', 'other')),
  external_name  text not null,
  unit_id        uuid references an_units (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (workspace_id, channel, external_name)
);

create index an_listings_unit_idx on an_listings (unit_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Imports and normalised transactions
-- ─────────────────────────────────────────────────────────────────────────

create table an_imports (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces (id) on delete cascade,
  channel         text not null check (channel in ('airbnb', 'booking', 'agoda', 'other')),
  file_name       text not null,
  row_count       integer not null default 0,
  inserted_count  integer not null default 0,
  duplicate_count integer not null default 0,
  skipped_count   integer not null default 0,
  period_start    date,
  period_end      date,
  fx_rates        jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index an_imports_ws_idx on an_imports (workspace_id, created_at desc);

create table an_transactions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces (id) on delete cascade,
  import_id       uuid not null references an_imports (id) on delete cascade,
  listing_id      uuid references an_listings (id) on delete set null,
  channel         text not null check (channel in ('airbnb', 'booking', 'agoda', 'other')),
  kind            text not null check (kind in (
                    'booking', 'payout', 'adjustment', 'resolution',
                    'cancellation', 'cohost', 'tax', 'other')),
  raw_type        text,
  txn_date        date not null,
  confirmation_code text,
  guest_name      text,
  check_in        date,
  check_out       date,
  nights          integer check (nights is null or nights >= 0),
  currency        text not null,
  -- Host earnings for this line in the file's currency (0 for payouts)…
  amount          numeric(14, 2) not null default 0,
  -- …and converted to the workspace's base currency at import time.
  fx_rate         numeric(14, 6) not null default 1 check (fx_rate > 0),
  amount_base     numeric(14, 2) not null default 0,
  gross           numeric(14, 2),
  service_fee     numeric(14, 2),
  cleaning_fee    numeric(14, 2),
  taxes           numeric(14, 2),
  paid_out        numeric(14, 2),
  details         text,
  -- Stable fingerprint of the source row: re-uploading an overlapping
  -- export skips rows already imported instead of double-counting them.
  dedupe_key      text not null,
  created_at      timestamptz not null default now(),
  unique (workspace_id, dedupe_key)
);

create index an_transactions_ws_date_idx on an_transactions (workspace_id, txn_date);
create index an_transactions_ws_stay_idx on an_transactions (workspace_id, check_in);
create index an_transactions_listing_idx on an_transactions (listing_id);
create index an_transactions_import_idx on an_transactions (import_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Expenses
-- ─────────────────────────────────────────────────────────────────────────

-- Fixed monthly costs per unit (rent/amortisation, utilities averages…),
-- entered once and applied to every month in range.
create table an_recurring_costs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces (id) on delete cascade,
  unit_id         uuid not null references an_units (id) on delete cascade,
  category        text not null,
  monthly_amount  numeric(12, 2) not null check (monthly_amount >= 0),
  starts_on       date not null,  -- first month it applies (any day in it)
  ends_on         date,           -- last month it applies; null = ongoing
  notes           text,
  created_at      timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index an_recurring_costs_unit_idx on an_recurring_costs (unit_id);
create index an_recurring_costs_ws_idx on an_recurring_costs (workspace_id);

-- One-off actual expenses, optionally with a receipt photo/PDF.
-- unit_id null = portfolio-wide cost (software, accountant…).
create table an_expenses (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  unit_id       uuid references an_units (id) on delete set null,
  category      text not null,
  amount        numeric(12, 2) not null check (amount > 0),
  spent_on      date not null,
  description   text,
  receipt_path  text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index an_expenses_ws_date_idx on an_expenses (workspace_id, spent_on);
create index an_expenses_unit_idx on an_expenses (unit_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RLS for workspace data: members read, owners/editors write while the
--    licence is active.
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'an_owners', 'an_units', 'an_listings', 'an_imports',
    'an_transactions', 'an_recurring_costs', 'an_expenses'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for select using (an_is_member(workspace_id))',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert with check (an_can_edit(workspace_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for update using (an_can_edit(workspace_id)) with check (an_can_edit(workspace_id))',
      t || '_update', t);
    execute format(
      'create policy %I on %I for delete using (an_can_edit(workspace_id))',
      t || '_delete', t);
  end loop;
end;
$$;

-- Cross-workspace references must stay inside one workspace (RLS alone
-- wouldn't stop pointing a unit at another customer's owner id). One guard
-- per table: plpgsql doesn't short-circuit, so a shared function would trip
-- over columns that only exist on some tables.
create or replace function an_guard_unit_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from an_owners where id = new.owner_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Owner belongs to another workspace';
  end if;
  return new;
end;
$$;

create or replace function an_guard_unit_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is not null and not exists (
    select 1 from an_units where id = new.unit_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Unit belongs to another workspace';
  end if;
  return new;
end;
$$;

create or replace function an_guard_transaction_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from an_imports where id = new.import_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Import belongs to another workspace';
  end if;
  if new.listing_id is not null and not exists (
    select 1 from an_listings where id = new.listing_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Listing belongs to another workspace';
  end if;
  return new;
end;
$$;

create trigger an_units_same_ws before insert or update on an_units
  for each row execute function an_guard_unit_owner();
create trigger an_listings_same_ws before insert or update on an_listings
  for each row execute function an_guard_unit_ref();
create trigger an_recurring_costs_same_ws before insert or update on an_recurring_costs
  for each row execute function an_guard_unit_ref();
create trigger an_expenses_same_ws before insert or update on an_expenses
  for each row execute function an_guard_unit_ref();
create trigger an_transactions_same_ws before insert or update on an_transactions
  for each row execute function an_guard_transaction_refs();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Storage: private receipts, public logos. Paths start with the
--    workspace id: '<workspace_id>/<file>'.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('an-receipts', 'an-receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('an-branding', 'an-branding', true)
on conflict (id) do nothing;

create policy an_receipts_select on storage.objects
  for select using (bucket_id = 'an-receipts' and an_is_member(an_path_workspace(name)));

create policy an_receipts_insert on storage.objects
  for insert with check (bucket_id = 'an-receipts' and an_can_edit(an_path_workspace(name)));

create policy an_receipts_delete on storage.objects
  for delete using (bucket_id = 'an-receipts' and an_can_edit(an_path_workspace(name)));

create policy an_branding_select on storage.objects
  for select using (bucket_id = 'an-branding');

create policy an_branding_insert on storage.objects
  for insert with check (bucket_id = 'an-branding' and an_is_ws_owner(an_path_workspace(name)));

create policy an_branding_update on storage.objects
  for update using (bucket_id = 'an-branding' and an_is_ws_owner(an_path_workspace(name)));

create policy an_branding_delete on storage.objects
  for delete using (bucket_id = 'an-branding' and an_is_ws_owner(an_path_workspace(name)));
