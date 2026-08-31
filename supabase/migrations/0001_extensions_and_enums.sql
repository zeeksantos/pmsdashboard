-- Extensions
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- exclusion constraint for double-booking prevention

-- Enums

create type user_role as enum (
  'owner_admin',
  'manager',
  'front_desk',
  'housekeeping',
  'maintenance'
);

create type unit_status as enum (
  'AVAILABLE',
  'OCCUPIED',
  'DIRTY',
  'CLEANING',
  'MAINTENANCE'
);

create type booking_status as enum (
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED'
);

create type payment_method as enum (
  'GCASH',
  'MAYA',
  'CASH',
  'BANK_TRANSFER',
  'CARD'
);

create type housekeeping_task_status as enum (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED'
);

create type maintenance_priority as enum (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

create type maintenance_status as enum (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

create type audit_action as enum (
  'INSERT',
  'UPDATE',
  'DELETE'
);
