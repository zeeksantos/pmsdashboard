-- Portfolio Analytics is sold to outside hosts and property managers, who
-- sign up on their own. They must never see this PMS's units, bookings or
-- guests, so they get a role that no PMS policy grants anything to.
--
-- Kept in its own migration: Postgres can't use a new enum value in the same
-- transaction that adds it.
alter type user_role add value if not exists 'analytics_only';
