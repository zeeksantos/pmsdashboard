-- User management from inside the HRIS: admin/owner can list logins, create a login with a role,
-- change a role and set a new password, without opening Supabase.
-- Logins are created by a database function (no service-role key is needed in the app).
-- Only an owner may create, change or reset an owner.

create or replace function list_logins()
returns table (user_id uuid, email text, role hris_role, last_sign_in_at timestamptz,
               created_at timestamptz, employee_id uuid, employee_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('admin', 'owner') then raise exception 'Not allowed'; end if;
  return query
    select u.id, u.email::text, coalesce(r.role, 'employee'::hris_role), u.last_sign_in_at,
           u.created_at, e.id, e.full_name
      from auth.users u
      left join user_roles r on r.user_id = u.id
      left join employees e on e.user_id = u.id
     order by u.created_at;
end $$;

create or replace function admin_create_user(
  p_email text, p_password text, p_role hris_role, p_employee uuid default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid := gen_random_uuid();
begin
  if not has_role('admin', 'owner') then raise exception 'Not allowed'; end if;
  if p_role = 'owner' and not has_role('owner') then
    raise exception 'Only an owner can create an owner';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email address doesn''t look right'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'The password must be at least 8 characters'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'A login with that email already exists';
  end if;
  if p_employee is not null then
    if not exists (select 1 from employees where id = p_employee) then raise exception 'Employee not found'; end if;
    if exists (select 1 from employees where id = p_employee and user_id is not null) then
      raise exception 'That employee already has a login';
    end if;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, provider, identity_data,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          now(), now(), now());

  insert into user_roles (user_id, role) values (v_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  if p_employee is not null then
    update employees set user_id = v_id, updated_at = now() where id = p_employee;
  end if;

  insert into audit_logs (user_id, role, action, resource, resource_id, details)
  values (auth.uid(), current_hris_role(), 'INSERT', 'logins', v_id::text,
          jsonb_build_object('email', v_email, 'role', p_role, 'employee_id', p_employee));
  return v_id;
end $$;

create or replace function admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not has_role('admin', 'owner') then raise exception 'Not allowed'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'The password must be at least 8 characters'; end if;
  if exists (select 1 from user_roles where user_id = p_user and role = 'owner') and not has_role('owner') then
    raise exception 'Only an owner can change an owner''s password';
  end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
   where id = p_user;
  if not found then raise exception 'Login not found'; end if;
  insert into audit_logs (user_id, role, action, resource, resource_id, details)
  values (auth.uid(), current_hris_role(), 'UPDATE', 'logins', p_user::text,
          jsonb_build_object('change', 'password reset'));
end $$;

-- Tighten the existing role-change function: no changing your own role (avoids locking yourself
-- out) and only an owner may change an owner.
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
  if uid = auth.uid() then raise exception 'You can''t change your own role'; end if;
  if exists (select 1 from user_roles where user_id = uid and role = 'owner') and not has_role('owner') then
    raise exception 'Only an owner can change an owner''s role';
  end if;
  insert into user_roles (user_id, role) values (uid, p_role)
  on conflict (user_id) do update set role = excluded.role;
end $$;

revoke execute on function list_logins(), admin_create_user(text, text, hris_role, uuid),
  admin_set_password(uuid, text) from public, anon;
grant execute on function list_logins(), admin_create_user(text, text, hris_role, uuid),
  admin_set_password(uuid, text) to authenticated;
