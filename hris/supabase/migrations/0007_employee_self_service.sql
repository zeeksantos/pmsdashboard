-- Employee self-service: an employee may update ONLY their own contact details.
-- Name, birthdate, gender, marital status, government IDs and all work info stay HR-only;
-- there is deliberately no table policy that lets employees write to employee_biodata.
create or replace function update_my_contact(
  p_nickname text,
  p_phone text,
  p_personal_email text,
  p_present_address text,
  p_city text,
  p_province text,
  p_emergency_contact_name text,
  p_emergency_contact_relationship text,
  p_emergency_contact_number text)
returns void language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  v_nickname text := nullif(trim(p_nickname), '');
  v_phone text := nullif(trim(p_phone), '');
  v_email text := nullif(trim(p_personal_email), '');
  v_address text := nullif(trim(p_present_address), '');
  v_city text := nullif(trim(p_city), '');
  v_province text := nullif(trim(p_province), '');
  v_ec_name text := nullif(trim(p_emergency_contact_name), '');
  v_ec_rel text := nullif(trim(p_emergency_contact_relationship), '');
  v_ec_num text := nullif(trim(p_emergency_contact_number), '');
begin
  if emp is null then raise exception 'No employee profile for this user'; end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address doesn''t look right';
  end if;
  if length(coalesce(v_nickname,'') || coalesce(v_phone,'') || coalesce(v_email,'') ||
            coalesce(v_address,'') || coalesce(v_city,'') || coalesce(v_province,'') ||
            coalesce(v_ec_name,'') || coalesce(v_ec_rel,'') || coalesce(v_ec_num,'')) > 1500
     or length(coalesce(v_address, '')) > 300 then
    raise exception 'One of the fields is too long';
  end if;

  update employees set nickname = v_nickname, updated_at = now() where id = emp;

  insert into employee_biodata (employee_id, phone, personal_email, present_address, city, province,
                                emergency_contact_name, emergency_contact_relationship,
                                emergency_contact_number)
  values (emp, v_phone, v_email, v_address, v_city, v_province, v_ec_name, v_ec_rel, v_ec_num)
  on conflict (employee_id) do update
    set phone = excluded.phone,
        personal_email = excluded.personal_email,
        present_address = excluded.present_address,
        city = excluded.city,
        province = excluded.province,
        emergency_contact_name = excluded.emergency_contact_name,
        emergency_contact_relationship = excluded.emergency_contact_relationship,
        emergency_contact_number = excluded.emergency_contact_number,
        updated_at = now();
end $$;

revoke execute on function update_my_contact(text, text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function update_my_contact(text, text, text, text, text, text, text, text, text)
  to authenticated;
