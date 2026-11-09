-- Tighten who can call SECURITY DEFINER functions through the API
-- (flagged by the Supabase security advisor).

-- Trigger functions: nobody calls them directly.
revoke execute on function audit_row_change() from public, anon, authenticated;
revoke execute on function handle_new_auth_user() from public, anon, authenticated;
revoke execute on function an_guard_unit_owner() from public, anon, authenticated;
revoke execute on function an_guard_unit_ref() from public, anon, authenticated;
revoke execute on function an_guard_transaction_refs() from public, anon, authenticated;

-- App RPCs: signed-in users only (each also checks permissions inside).
revoke execute on function an_create_workspace(text, text) from public, anon;
revoke execute on function an_accept_invites() from public, anon;
revoke execute on function an_record_license(uuid, text, integer, integer, numeric, text) from public, anon;
revoke execute on function an_admin_workspaces() from public, anon;
revoke execute on function an_workspace_member_list(uuid) from public, anon;
revoke execute on function check_in_booking(uuid) from public, anon;
revoke execute on function checkout_booking(uuid) from public, anon;
revoke execute on function start_housekeeping_task(uuid) from public, anon;
revoke execute on function complete_housekeeping_task(uuid) from public, anon;
grant execute on function an_create_workspace(text, text) to authenticated;
grant execute on function an_accept_invites() to authenticated;
grant execute on function an_record_license(uuid, text, integer, integer, numeric, text) to authenticated;
grant execute on function an_admin_workspaces() to authenticated;
grant execute on function an_workspace_member_list(uuid) to authenticated;
grant execute on function check_in_booking(uuid) to authenticated;
grant execute on function checkout_booking(uuid) to authenticated;
grant execute on function start_housekeeping_task(uuid) to authenticated;
grant execute on function complete_housekeeping_task(uuid) to authenticated;

-- Helpers used inside RLS policies stay callable (they only report on the
-- caller's own access). Pin search_path on the two that lacked it.
alter function set_updated_at() set search_path = public;
alter function an_path_workspace(text) set search_path = public;
