"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, CalendarDays, ClipboardCheck, ClipboardList, Clock, Home, LogOut, Network, Plane, Receipt, Settings, Shield, User, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

const icons = {
  home: Home,
  clock: Clock,
  calendar: CalendarDays,
  users: Users,
  user: User,
  network: Network,
  clipboard: ClipboardList,
  wallet: Wallet,
  shield: Shield,
  plane: Plane,
  approve: ClipboardCheck,
  settings: Settings,
  receipt: Receipt,
  banknote: Banknote,
};

export type NavItem = { href: string; label: string; icon: keyof typeof icons };

export function Sidebar({
  items,
  name,
  roleLabel,
  signOut,
}: {
  items: NavItem[];
  name: string;
  roleLabel: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="print:hidden border-b border-border bg-surface md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-4 py-3 md:block md:py-6">
        <div>
          <p className="text-lg font-semibold">Z-Fast HRIS</p>
          <p className="text-xs text-muted">
            {name} · {roleLabel}
          </p>
        </div>
        <form action={signOut} className="md:hidden">
          <button aria-label="Sign out" className="p-2 text-muted hover:text-foreground">
            <LogOut size={18} />
          </button>
        </form>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3">
        {items.map(({ href, label, icon }) => {
          const Icon = icons[icon];
          const active =
            href === "/"
              ? pathname === "/"
              : href === "/leave"
                ? pathname === "/leave" || pathname.startsWith("/leave/settings")
              : href === "/employees"
                ? pathname === "/employees" || pathname.startsWith("/employees/new")
                : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:bg-surface-raised hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={signOut} className="hidden px-3 py-4 md:block">
        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground">
          <LogOut size={16} />
          Sign out
        </button>
      </form>
    </aside>
  );
}
