// Hand-written to match supabase/migrations/*. Once a real Supabase project
// exists, prefer regenerating this with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
//
// Note: entity shapes below must be `type` aliases, not `interface`s —
// TypeScript interfaces aren't assignable to `Record<string, unknown>`,
// which is required by supabase-js's GenericTable constraint.

export type UserRole =
  | "owner_admin"
  | "manager"
  | "front_desk"
  | "housekeeping"
  | "maintenance";

export type UnitStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "DIRTY"
  | "CLEANING"
  | "MAINTENANCE";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

export type PaymentMethod = "GCASH" | "MAYA" | "CASH" | "BANK_TRANSFER" | "CARD";

export type HousekeepingTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type MaintenanceStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  name: string;
  unit_type: string;
  max_capacity: number;
  nightly_rate: number;
  amenities: string[];
  status: UnitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Guest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_type: string | null;
  id_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  unit_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  reference_no: string | null;
  paid_at: string;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
};

export type HousekeepingTask = {
  id: string;
  unit_id: string;
  booking_id: string | null;
  status: HousekeepingTaskStatus;
  assigned_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type MaintenanceTicket = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type UnitPhoto = {
  id: string;
  unit_id: string;
  storage_path: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_role: UserRole | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; full_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      units: {
        Row: Unit;
        Insert: Partial<Unit> & Pick<Unit, "name" | "unit_type" | "max_capacity" | "nightly_rate">;
        Update: Partial<Unit>;
        Relationships: [];
      };
      guests: {
        Row: Guest;
        Insert: Partial<Guest> & Pick<Guest, "full_name">;
        Update: Partial<Guest>;
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: Partial<Booking> & Pick<Booking, "unit_id" | "guest_id" | "check_in" | "check_out">;
        Update: Partial<Booking>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & Pick<Payment, "booking_id" | "amount" | "method">;
        Update: Partial<Payment>;
        Relationships: [];
      };
      housekeeping_tasks: {
        Row: HousekeepingTask;
        Insert: Partial<HousekeepingTask> & Pick<HousekeepingTask, "unit_id">;
        Update: Partial<HousekeepingTask>;
        Relationships: [];
      };
      maintenance_tickets: {
        Row: MaintenanceTicket;
        Insert: Partial<MaintenanceTicket> & Pick<MaintenanceTicket, "unit_id" | "title">;
        Update: Partial<MaintenanceTicket>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      unit_photos: {
        Row: UnitPhoto;
        Insert: Partial<UnitPhoto> & Pick<UnitPhoto, "unit_id" | "storage_path">;
        Update: Partial<UnitPhoto>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_in_booking: { Args: { p_booking_id: string }; Returns: void };
      checkout_booking: { Args: { p_booking_id: string }; Returns: void };
      start_housekeeping_task: { Args: { p_task_id: string }; Returns: void };
      complete_housekeeping_task: { Args: { p_task_id: string }; Returns: void };
    };
  };
};
