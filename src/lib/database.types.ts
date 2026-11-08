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
  | "maintenance"
  // Portfolio Analytics customers: no PMS access (supabase/migrations/0009-0010).
  | "analytics_only";

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


// ── Portfolio Analytics (supabase/migrations/0010_analytics.sql) ─────────

export type AnChannel = "airbnb" | "booking" | "agoda" | "other";
export type AnTxnKind =
  | "booking"
  | "payout"
  | "adjustment"
  | "resolution"
  | "cancellation"
  | "cohost"
  | "tax"
  | "other";
export type WorkspaceKind = "host" | "manager";
export type WorkspaceRole = "owner" | "editor" | "viewer";

export type Workspace = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  brand_name: string | null;
  brand_logo_path: string | null;
  brand_color: string | null;
  statement_footer: string | null;
  base_currency: string;
  trial_ends_at: string;
  access_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type WorkspaceInvite = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string | null;
  created_at: string;
};

export type AnLicenseEvent = {
  id: string;
  workspace_id: string;
  kind: "activated" | "renewed" | "trial_extended";
  years: number;
  days: number;
  amount: number | null;
  note: string | null;
  access_until: string | null;
  created_by: string | null;
  created_at: string;
};

export type AnOwner = {
  id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  management_fee_pct: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AnUnit = {
  id: string;
  workspace_id: string;
  owner_id: string | null;
  name: string;
  building: string | null;
  area: string | null;
  active_from: string | null;
  archived: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AnListing = {
  id: string;
  workspace_id: string;
  channel: AnChannel;
  external_name: string;
  unit_id: string | null;
  created_at: string;
};

export type AnImport = {
  id: string;
  workspace_id: string;
  channel: AnChannel;
  file_name: string;
  row_count: number;
  inserted_count: number;
  duplicate_count: number;
  skipped_count: number;
  period_start: string | null;
  period_end: string | null;
  fx_rates: Record<string, number>;
  created_by: string | null;
  created_at: string;
};

export type AnTransaction = {
  id: string;
  workspace_id: string;
  import_id: string;
  listing_id: string | null;
  channel: AnChannel;
  kind: AnTxnKind;
  raw_type: string | null;
  txn_date: string;
  confirmation_code: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  currency: string;
  amount: number;
  fx_rate: number;
  amount_base: number;
  gross: number | null;
  service_fee: number | null;
  cleaning_fee: number | null;
  taxes: number | null;
  paid_out: number | null;
  details: string | null;
  dedupe_key: string;
  created_at: string;
};

export type AnRecurringCost = {
  id: string;
  workspace_id: string;
  unit_id: string;
  category: string;
  monthly_amount: number;
  starts_on: string;
  ends_on: string | null;
  notes: string | null;
  created_at: string;
};

export type AnExpense = {
  id: string;
  workspace_id: string;
  unit_id: string | null;
  category: string;
  amount: number;
  spent_on: string;
  description: string | null;
  receipt_path: string | null;
  created_by: string | null;
  created_at: string;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  owner_email: string | null;
  member_count: number;
  unit_count: number;
  transaction_count: number;
  last_import_at: string | null;
  trial_ends_at: string;
  access_until: string | null;
  created_at: string;
};

export type WorkspaceMemberListRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: WorkspaceRole;
  created_at: string;
};

type AnTable<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
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
      an_platform_admins: AnTable<{ user_id: string; created_at: string }, "user_id">;
      workspaces: AnTable<Workspace, "name">;
      workspace_members: AnTable<WorkspaceMember, "workspace_id" | "user_id">;
      workspace_invites: AnTable<WorkspaceInvite, "workspace_id" | "email">;
      an_license_events: AnTable<AnLicenseEvent, "workspace_id" | "kind">;
      an_owners: AnTable<AnOwner, "workspace_id" | "name">;
      an_units: AnTable<AnUnit, "workspace_id" | "name">;
      an_listings: AnTable<AnListing, "workspace_id" | "channel" | "external_name">;
      an_imports: AnTable<AnImport, "workspace_id" | "channel" | "file_name">;
      an_transactions: AnTable<
        AnTransaction,
        "workspace_id" | "import_id" | "channel" | "kind" | "txn_date" | "currency" | "dedupe_key"
      >;
      an_recurring_costs: AnTable<
        AnRecurringCost,
        "workspace_id" | "unit_id" | "category" | "monthly_amount" | "starts_on"
      >;
      an_expenses: AnTable<AnExpense, "workspace_id" | "category" | "amount" | "spent_on">;
    };
    Views: Record<string, never>;
    Functions: {
      check_in_booking: { Args: { p_booking_id: string }; Returns: void };
      checkout_booking: { Args: { p_booking_id: string }; Returns: void };
      start_housekeeping_task: { Args: { p_task_id: string }; Returns: void };
      complete_housekeeping_task: { Args: { p_task_id: string }; Returns: void };
      an_create_workspace: { Args: { p_name: string; p_kind: WorkspaceKind }; Returns: string };
      an_accept_invites: { Args: Record<string, never>; Returns: number };
      an_record_license: {
        Args: {
          p_workspace: string;
          p_kind: "activated" | "renewed" | "trial_extended";
          p_years: number;
          p_days: number;
          p_amount: number | null;
          p_note: string | null;
        };
        Returns: string;
      };
      an_admin_workspaces: { Args: Record<string, never>; Returns: AdminWorkspaceRow[] };
      an_workspace_member_list: { Args: { p_workspace: string }; Returns: WorkspaceMemberListRow[] };
      an_is_platform_admin: { Args: Record<string, never>; Returns: boolean };
    };
  };
};
