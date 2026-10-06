-- The employee list shows each person's login email. Emails live in Supabase Auth, which the app
-- can't read directly, so this narrow function returns them, for HR, admin and owner only.
create or replace function employee_login_emails()
returns table (employee_id uuid, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('hr', 'admin', 'owner') then raise exception 'Not allowed'; end if;
  return query
    select e.id, u.email::text
      from employees e
      join auth.users u on u.id = e.user_id;
end $$;

revoke execute on function employee_login_emails() from public, anon;
grant execute on function employee_login_emails() to authenticated;
