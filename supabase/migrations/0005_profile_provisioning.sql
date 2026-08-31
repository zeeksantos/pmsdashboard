-- Every auth.users row needs a matching profiles row or auth_role() returns
-- null and RLS blocks the user from everything. New signups default to
-- front_desk; promote to owner_admin/manager etc. by hand (or via the
-- Owner/Admin UI once it exists) — role changes are owner_admin-only, see
-- 0004_rls.sql.
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
    'front_desk'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
