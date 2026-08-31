import type {
  BookingStatus,
  HousekeepingTaskStatus,
  MaintenancePriority,
  MaintenanceStatus,
  UnitStatus,
} from "@/lib/database.types";

export const UNIT_STATUS_STYLES: Record<UnitStatus, string> = {
  AVAILABLE: "bg-success/15 text-success",
  OCCUPIED: "bg-accent/15 text-accent",
  DIRTY: "bg-danger/15 text-danger",
  CLEANING: "bg-warning/15 text-warning",
  MAINTENANCE: "bg-muted/20 text-muted",
};

export const UNIT_STATUSES: UnitStatus[] = [
  "AVAILABLE",
  "OCCUPIED",
  "DIRTY",
  "CLEANING",
  "MAINTENANCE",
];

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  CONFIRMED: "bg-accent/15 text-accent",
  CHECKED_IN: "bg-success/15 text-success",
  CHECKED_OUT: "bg-muted/20 text-muted",
  CANCELLED: "bg-danger/15 text-danger",
};

export const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
];

export const HOUSEKEEPING_TASK_STATUS_STYLES: Record<HousekeepingTaskStatus, string> = {
  PENDING: "bg-danger/15 text-danger",
  IN_PROGRESS: "bg-warning/15 text-warning",
  COMPLETED: "bg-success/15 text-success",
};

export const MAINTENANCE_STATUS_STYLES: Record<MaintenanceStatus, string> = {
  OPEN: "bg-danger/15 text-danger",
  IN_PROGRESS: "bg-warning/15 text-warning",
  RESOLVED: "bg-success/15 text-success",
  CLOSED: "bg-muted/20 text-muted",
};

export const MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

export const MAINTENANCE_PRIORITY_STYLES: Record<MaintenancePriority, string> = {
  LOW: "bg-muted/20 text-muted",
  MEDIUM: "bg-accent/15 text-accent",
  HIGH: "bg-warning/15 text-warning",
  URGENT: "bg-danger/15 text-danger",
};

export const MAINTENANCE_PRIORITIES: MaintenancePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
