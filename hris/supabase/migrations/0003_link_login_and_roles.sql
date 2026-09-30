-- Link an existing Supabase Auth login to an employee record (HR/admin/owner).
create or replace function link_employee_login(p_employee uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not has_role('hr', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No login found for that email. Create the user in Supabase Authentication first.';
  end if;
  if exists (select 1 from employees where user_id = uid and id <> p_employee) then
    raise exception 'That login is already linked to another employee';
  end if;
  update employees set user_id = uid, updated_at = now() where id = p_employee;
end $$;

-- Change a login's role. Admin/owner only; only an owner may grant owner.
create or replace function set_user_role(p_email text, p_role hris_role)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not has_role('admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_role = 'owner' and not has_role('owner') then
    raise exception 'Only an owner can grant the owner role';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No login found for that email'; end if;
  insert into user_roles (user_id, role) values (uid, p_role)
  on conflict (user_id) do update set role = excluded.role;
end $$;

revoke execute on function link_employee_login(uuid, text) from public, anon;
revoke execute on function set_user_role(text, hris_role) from public, anon;
grant execute on function link_employee_login(uuid, text) to authenticated;
grant execute on function set_user_role(text, hris_role) to authenticated;
