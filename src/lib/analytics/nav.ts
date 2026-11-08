import type { NavItem } from "@/lib/nav";
import type { WorkspaceKind } from "@/lib/database.types";

export function analyticsNav(kind: WorkspaceKind, isPlatformAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/analytics", label: "Overview", icon: "ChartLine", roles: [], exact: true },
    { href: "/analytics/units", label: "Units & listings", icon: "Building2", roles: [] },
    { href: "/analytics/profit", label: "Profit & break-even", icon: "TrendingUp", roles: [] },
    { href: "/analytics/expenses", label: "Expenses", icon: "Wallet", roles: [] },
    { href: "/analytics/alerts", label: "Alerts", icon: "BellRing", roles: [] },
  ];
  if (kind === "manager") {
    items.push({ href: "/analytics/owners", label: "Owners & statements", icon: "UserRound", roles: [] });
  }
  items.push(
    { href: "/analytics/transactions", label: "Transactions", icon: "ListOrdered", roles: [] },
    { href: "/analytics/import", label: "Upload exports", icon: "Upload", roles: [] },
    { href: "/analytics/settings", label: "Settings", icon: "Settings", roles: [] }
  );
  if (isPlatformAdmin) {
    items.push({ href: "/analytics/admin", label: "Customers (admin)", icon: "ShieldCheck", roles: [] });
  }
  return items;
}
