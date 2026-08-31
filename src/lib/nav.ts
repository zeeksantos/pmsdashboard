import type { UserRole } from "@/lib/database.types";

export type IconName =
  | "LayoutDashboard"
  | "BedDouble"
  | "Users"
  | "CalendarRange"
  | "CalendarDays"
  | "LogIn"
  | "Receipt"
  | "Sparkles"
  | "Wrench"
  | "Bell"
  | "ScrollText";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = [
  "owner_admin",
  "manager",
  "front_desk",
  "housekeeping",
  "maintenance",
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard", roles: ALL_ROLES },
  { href: "/units", label: "Units & Rates", icon: "BedDouble", roles: ALL_ROLES },
  { href: "/guests", label: "Guests", icon: "Users", roles: ["owner_admin", "manager", "front_desk"] },
  { href: "/bookings", label: "Bookings", icon: "CalendarRange", roles: ["owner_admin", "manager", "front_desk"] },
  { href: "/calendar", label: "Calendar", icon: "CalendarDays", roles: ["owner_admin", "manager", "front_desk"] },
  { href: "/check-in-out", label: "Check-In / Out", icon: "LogIn", roles: ["owner_admin", "manager", "front_desk"] },
  { href: "/billing", label: "Billing & Payments", icon: "Receipt", roles: ["owner_admin", "manager", "front_desk"] },
  { href: "/housekeeping", label: "Housekeeping", icon: "Sparkles", roles: ["owner_admin", "manager", "housekeeping"] },
  { href: "/maintenance", label: "Maintenance", icon: "Wrench", roles: ["owner_admin", "manager", "maintenance"] },
  { href: "/notifications", label: "Notifications", icon: "Bell", roles: ALL_ROLES },
  { href: "/audit-logs", label: "Audit Logs", icon: "ScrollText", roles: ["owner_admin", "manager"] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
