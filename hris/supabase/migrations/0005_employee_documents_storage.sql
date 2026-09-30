-- Private bucket for employee documents (contracts, IDs, clearances).
-- File path convention: <employee_id>/<uuid>-<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents', 'employee-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Extra metadata on the existing employee_documents table.
alter table employee_documents
  add column if not exists file_name text,
  add column if not exists size_bytes bigint,
  add column if not exists mime_type text,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;
create index if not exists employee_documents_employee_idx on employee_documents (employee_id);

-- Storage access: HR/admin/owner manage everything; an employee may read only their own folder.
create policy "emp docs read" on storage.objects for select to authenticated using (
  bucket_id = 'employee-documents'
  and (has_role('hr', 'admin', 'owner')
       or (storage.foldername(name))[1] = current_employee_id()::text)
);
create policy "emp docs insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'employee-documents' and has_role('hr', 'admin', 'owner')
);
create policy "emp docs update" on storage.objects for update to authenticated
  using (bucket_id = 'employee-documents' and has_role('hr', 'admin', 'owner'))
  with check (bucket_id = 'employee-documents' and has_role('hr', 'admin', 'owner'));
create policy "emp docs delete" on storage.objects for delete to authenticated using (
  bucket_id = 'employee-documents' and has_role('hr', 'admin', 'owner')
);
