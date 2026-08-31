-- Generic audit trigger: fires on every INSERT/UPDATE/DELETE for the tables
-- it's attached to, so no module can "forget" to write an audit entry.
-- auth.uid() resolves to the calling user's id when the request goes through
-- Supabase's authenticated client; it's null for service-role/seed scripts.
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

create trigger audit_units
  after insert or update or delete on units
  for each row execute function audit_row_change();

create trigger audit_guests
  after insert or update or delete on guests
  for each row execute function audit_row_change();

create trigger audit_bookings
  after insert or update or delete on bookings
  for each row execute function audit_row_change();

create trigger audit_payments
  after insert or update or delete on payments
  for each row execute function audit_row_change();

create trigger audit_housekeeping_tasks
  after insert or update or delete on housekeeping_tasks
  for each row execute function audit_row_change();

create trigger audit_maintenance_tickets
  after insert or update or delete on maintenance_tickets
  for each row execute function audit_row_change();

create trigger audit_profiles
  after insert or update or delete on profiles
  for each row execute function audit_row_change();

-- audit_logs itself is immutable: no update or delete, from any role.
revoke update, delete on audit_logs from anon, authenticated;
