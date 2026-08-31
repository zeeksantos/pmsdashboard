-- Unit photo gallery. Files live in a public Storage bucket (photos aren't
-- sensitive); this table just tracks which files belong to which unit and
-- in what order.

insert into storage.buckets (id, name, public)
values ('unit-photos', 'unit-photos', true)
on conflict (id) do nothing;

create table unit_photos (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references units (id) on delete cascade,
  storage_path  text not null,
  sort_order    integer not null default 0,
  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now()
);

create index unit_photos_unit_id_idx on unit_photos (unit_id, sort_order);

alter table unit_photos enable row level security;

create policy unit_photos_select_all on unit_photos
  for select using (auth_role() is not null);

create policy unit_photos_write_admin_manager_frontdesk on unit_photos
  for all
  using (auth_role() in ('owner_admin', 'manager', 'front_desk'))
  with check (auth_role() in ('owner_admin', 'manager', 'front_desk'));

create trigger audit_unit_photos
  after insert or update or delete on unit_photos
  for each row execute function audit_row_change();

-- Storage policies: anyone signed in can read (bucket is public anyway,
-- this covers direct API access too); only admin/manager/front_desk can
-- upload or delete unit photos.
create policy unit_photos_storage_select on storage.objects
  for select using (bucket_id = 'unit-photos' and auth_role() is not null);

create policy unit_photos_storage_insert on storage.objects
  for insert
  with check (
    bucket_id = 'unit-photos'
    and auth_role() in ('owner_admin', 'manager', 'front_desk')
  );

create policy unit_photos_storage_delete on storage.objects
  for delete
  using (
    bucket_id = 'unit-photos'
    and auth_role() in ('owner_admin', 'manager', 'front_desk')
  );
