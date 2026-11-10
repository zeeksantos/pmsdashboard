-- Portfolio Analytics: data needed for the full tabbed dashboard.
--
-- - booked_on: when the guest booked (lead time, "how far ahead guests book").
-- - nickname: the property's guest-facing name ("Lantern Tavern"), shown
--   next to the unit number everywhere.
-- - an_unit_costs: each unit's standard monthly bills, entered once. Rent,
--   other fixed, electricity and water are charged every month from the
--   unit's first stay; cleaning_per_stay drives the break-even forecast.
-- - an_monthly_costs: actual cleaning / other bills for one unit in one month.
-- These replace an_recurring_costs, which is dropped in 0013.

alter table an_transactions add column if not exists booked_on date;
alter table an_units add column if not exists nickname text;

create table an_unit_costs (
  unit_id            uuid primary key references an_units (id) on delete cascade,
  workspace_id       uuid not null references workspaces (id) on delete cascade,
  rent               numeric(12, 2) not null default 0 check (rent >= 0),
  other_fixed        numeric(12, 2) not null default 0 check (other_fixed >= 0),
  electricity        numeric(12, 2) not null default 0 check (electricity >= 0),
  water              numeric(12, 2) not null default 0 check (water >= 0),
  cleaning_per_stay  numeric(12, 2) not null default 0 check (cleaning_per_stay >= 0),
  updated_at         timestamptz not null default now()
);

create index an_unit_costs_ws_idx on an_unit_costs (workspace_id);

create trigger an_unit_costs_set_updated_at
  before update on an_unit_costs
  for each row execute function set_updated_at();

create table an_monthly_costs (
  unit_id       uuid not null references an_units (id) on delete cascade,
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  cleaning      numeric(12, 2) not null default 0 check (cleaning >= 0),
  other         numeric(12, 2) not null default 0 check (other >= 0),
  updated_at    timestamptz not null default now(),
  primary key (unit_id, month)
);

create index an_monthly_costs_ws_idx on an_monthly_costs (workspace_id, month);

create trigger an_monthly_costs_set_updated_at
  before update on an_monthly_costs
  for each row execute function set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['an_unit_costs', 'an_monthly_costs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (an_is_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on %I for insert with check (an_can_edit(workspace_id))', t || '_insert', t);
    execute format(
      'create policy %I on %I for update using (an_can_edit(workspace_id)) with check (an_can_edit(workspace_id))',
      t || '_update', t);
    execute format('create policy %I on %I for delete using (an_can_edit(workspace_id))', t || '_delete', t);
    execute format(
      'create trigger %I before insert or update on %I for each row execute function an_guard_unit_ref()',
      t || '_same_ws', t);
  end loop;
end;
$$;
