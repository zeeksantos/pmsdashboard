-- Z-Fast HRIS schema. Timezone: Asia/Manila. Fixed schedules, web + GPS time in/out.
create extension if not exists pgcrypto;

create type hris_role as enum ('employee', 'manager', 'hr', 'finance', 'admin', 'owner');
create type employment_type as enum ('REGULAR', 'CONTRACTUAL', 'PART_TIME');
create type employment_status as enum ('ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED');
create type gender as enum ('MALE', 'FEMALE');
create type civil_status as enum ('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED');
create type audit_action as enum ('INSERT', 'UPDATE', 'DELETE');

-- Departments ---------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
insert into departments (name) values
  ('Admin'), ('Finance'), ('HR'), ('Marketing'), ('Business Development');

create table positions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id uuid not null references departments(id),
  unique (department_id, title)
);

-- Employees: work info only. Visible to managers, HR, admin/owner; self. -----
create table employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  employee_no text not null unique,
  full_name text not null,
  nickname text,
  work_email text,
  department_id uuid references departments(id),
  position_id uuid references positions(id),
  reports_to uuid references employees(id),          -- drives the org chart
  employment_type employment_type not null default 'REGULAR',
  status employment_status not null default 'ACTIVE',
  date_hired date not null,
  regularization_date date,
  contract_end_date date,                             -- contractuals
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id <> reports_to)
);
create index on employees (department_id);
create index on employees (reports_to);

-- Roles: managed by admin/owner only ----------------------------------------
create table user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role hris_role not null default 'employee'
);

-- Biodata + government IDs (from the biodata form). HR/admin/owner; self ----
create table employee_biodata (
  employee_id uuid primary key references employees(id) on delete cascade,
  date_of_birth date,
  place_of_birth text,
  gender gender,
  civil_status civil_status,
  nationality text default 'Filipino',
  phone text,
  personal_email text,
  present_address text,
  city text,
  province text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_number text,
  sss_no text,
  philhealth_no text,
  pagibig_no text,
  tin text,
  form_date date,                                     -- date on the biodata form
  updated_at timestamptz not null default now()
);

-- Documents (contract, IDs, clearances); files live in Supabase Storage -------
create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  doc_type text not null,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

-- Salary: finance + admin/owner only ----------------------------------------
create table employee_salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  monthly_rate numeric(12,2),                         -- PHP
  hourly_rate numeric(10,2),                          -- part-timers/contractuals
  effective_from date not null,
  created_at timestamptz not null default now()
);
create index on employee_salaries (employee_id, effective_from desc);

-- Fixed schedules. days_of_week: 0=Sun..6=Sat. Rest days/holidays = normal days.
create table work_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  days_of_week smallint[] not null default '{1,2,3,4,5}',
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date,
  effective_to date
);
create index on work_schedules (employee_id, effective_from desc);

-- Attendance: one row per employee per Manila work date ----------------------
create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  in_lat double precision, in_lng double precision, in_accuracy_m real,
  out_lat double precision, out_lng double precision, out_accuracy_m real,
  late_minutes integer not null default 0,
  undertime_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (time_out is null or time_in is null or time_out >= time_in)
);
create index on attendance_logs (work_date);

-- Audit log: append-only ----------------------------------------------------
create table audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  role hris_role,
  action audit_action not null,
  resource text not null,
  resource_id text,
  details jsonb
);
