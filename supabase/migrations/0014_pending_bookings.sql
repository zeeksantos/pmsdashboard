-- Portfolio Analytics: upcoming (not yet paid) bookings.
--
-- Airbnb's "pending" export lists reservations that haven't paid out yet.
-- Those rows are kept in an_transactions with pending = true so they never
-- count as earnings; the dashboard's Upcoming tab reads them instead. When a
-- Transaction history export with the paid line arrives, the import replaces
-- the pending row (matched by confirmation code), and a newer pending export
-- replaces the older one for the same listings (so cancellations drop off).

alter table an_transactions add column if not exists pending boolean not null default false;
alter table an_imports add column if not exists pending boolean not null default false;

create index if not exists an_transactions_pending_idx
  on an_transactions (workspace_id, confirmation_code)
  where pending;
