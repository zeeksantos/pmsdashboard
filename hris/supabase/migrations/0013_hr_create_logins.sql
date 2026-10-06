-- HR may create logins too, but only for the lower access levels and only for an employee record:
-- employee, manager or hr. Finance (salary access), admin and owner stay with admin/owner.
-- Everything else about login creation is unchanged (see 0012).
create or replace function admin_create_user(
  p_email text, p_password text, p_role hris_role, p_employee uuid default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid := gen_random_uuid();
begin
  if not has_role('hr', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  if not has_role('admin', 'owner') then
    if p_role not in ('employee', 'manager', 'hr') then
      raise exception 'HR can create employee, manager or HR logins only';
    end if;
    if p_employee is null then raise exception 'HR can only create a login for an employee record'; end if;
  end if;
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
