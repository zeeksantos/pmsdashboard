-- an_recurring_costs was replaced by an_unit_costs / an_monthly_costs (0012)
-- and is no longer read or written by the app. Kept separate because
-- Supabase asks for confirmation before running destructive statements.
drop table if exists an_recurring_costs;
