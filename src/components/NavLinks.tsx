"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BedDouble,
  Users,
  CalendarRange,
  CalendarDays,
  LogIn,
  Receipt,
  Sparkles,
  Wrench,
  Bell,
  ScrollText,
  ChartLine,
  Upload,
  Building2,
  Wallet,
  TrendingUp,
  BellRing,
  UserRound,
  ListOrdered,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { NavItem, IconName } from "@/lib/nav";
import { cn } from "@/lib/cn";

const ICONS: Record<IconName, LucideIcon> = {
  LayoutDashboard,
  BedDouble,
  Users,
  CalendarRange,
  CalendarDays,
  LogIn,
  Receipt,
  Sparkles,
  Wrench,
  Bell,
  ScrollText,
  ChartLine,
  Upload,
  Building2,
  Wallet,
  TrendingUp,
  BellRing,
  UserRound,
  ListOrdered,
  Settings,
  ShieldCheck,
};

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive =
          item.href === "/" || item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-surface-raised hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
