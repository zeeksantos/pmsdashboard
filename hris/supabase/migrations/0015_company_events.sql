-- Company calendar: company events plus Philippine holidays (regular and special non-working).
-- Everyone signed in can read it; HR, admin and owner can add, edit and remove entries.
-- Holidays are shown on the calendar only. Payroll still treats them as normal days.
create type company_event_kind as enum ('EVENT', 'REGULAR_HOLIDAY', 'SPECIAL_HOLIDAY');

create table company_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  kind company_event_kind not null default 'EVENT',
  start_date date not null,
  end_date date not null,
  note text check (note is null or length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (title, start_date)
);
create index on company_events (start_date);

-- Holidays set by law on a fixed date, or computed from Easter (Holy Thursday, Good Friday and
-- Black Saturday) and the "last Monday of August" rule, for 2026 and 2027. Holidays that are
-- proclaimed each year (Eid'l Fitr, Eid'l Adha, Chinese New Year, All Souls' Day, special working
-- days) are not included: add them here once the proclamation is out.
insert into company_events (title, kind, start_date, end_date)
select title, kind::company_event_kind, d::date, d::date
from (values
  ('New Year''s Day',                         'REGULAR_HOLIDAY', '2026-01-01'),
  ('Maundy Thursday',                         'REGULAR_HOLIDAY', '2026-04-02'),
  ('Good Friday',                             'REGULAR_HOLIDAY', '2026-04-03'),
  ('Black Saturday',                          'SPECIAL_HOLIDAY', '2026-04-04'),
  ('Araw ng Kagitingan (Day of Valor)',       'REGULAR_HOLIDAY', '2026-04-09'),
  ('Labor Day',                               'REGULAR_HOLIDAY', '2026-05-01'),
  ('Independence Day',                        'REGULAR_HOLIDAY', '2026-06-12'),
  ('Ninoy Aquino Day',                        'SPECIAL_HOLIDAY', '2026-08-21'),
  ('National Heroes Day',                     'REGULAR_HOLIDAY', '2026-08-31'),
  ('All Saints'' Day',                        'SPECIAL_HOLIDAY', '2026-11-01'),
  ('Bonifacio Day',                           'REGULAR_HOLIDAY', '2026-11-30'),
  ('Feast of the Immaculate Conception',      'SPECIAL_HOLIDAY', '2026-12-08'),
  ('Christmas Eve',                           'SPECIAL_HOLIDAY', '2026-12-24'),
  ('Christmas Day',                           'REGULAR_HOLIDAY', '2026-12-25'),
  ('Rizal Day',                               'REGULAR_HOLIDAY', '2026-12-30'),
  ('Last Day of the Year',                    'SPECIAL_HOLIDAY', '2026-12-31'),
  ('New Year''s Day',                         'REGULAR_HOLIDAY', '2027-01-01'),
  ('Maundy Thursday',                         'REGULAR_HOLIDAY', '2027-03-25'),
  ('Good Friday',                             'REGULAR_HOLIDAY', '2027-03-26'),
  ('Black Saturday',                          'SPECIAL_HOLIDAY', '2027-03-27'),
  ('Araw ng Kagitingan (Day of Valor)',       'REGULAR_HOLIDAY', '2027-04-09'),
  ('Labor Day',                               'REGULAR_HOLIDAY', '2027-05-01'),
  ('Independence Day',                        'REGULAR_HOLIDAY', '2027-06-12'),
  ('Ninoy Aquino Day',                        'SPECIAL_HOLIDAY', '2027-08-21'),
  ('National Heroes Day',                     'REGULAR_HOLIDAY', '2027-08-30'),
  ('All Saints'' Day',                        'SPECIAL_HOLIDAY', '2027-11-01'),
  ('Bonifacio Day',                           'REGULAR_HOLIDAY', '2027-11-30'),
  ('Feast of the Immaculate Conception',      'SPECIAL_HOLIDAY', '2027-12-08'),
  ('Christmas Eve',                           'SPECIAL_HOLIDAY', '2027-12-24'),
  ('Christmas Day',                           'REGULAR_HOLIDAY', '2027-12-25'),
  ('Rizal Day',                               'REGULAR_HOLIDAY', '2027-12-30'),
  ('Last Day of the Year',                    'SPECIAL_HOLIDAY', '2027-12-31')
) as h(title, kind, d)
on conflict do nothing;

alter table company_events enable row level security;
create policy ce_read on company_events for select using (auth.uid() is not null);
create policy ce_write on company_events for all
  using (has_role('hr', 'admin', 'owner')) with check (has_role('hr', 'admin', 'owner'));

-- Audit changes made from now on (the starting holiday list above is not logged).
create trigger audit_company_events after insert or update or delete on company_events
  for each row execute function audit_row();
