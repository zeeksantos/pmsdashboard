"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote, ChevronDown, Clock, LayoutDashboard, LogOut, Menu, Plane, Receipt, Settings, Shield, User, Users, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeHref, allHrefs, type NavGroup, type NavIcon } from "@/lib/nav";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";

const icons: Record<NavIcon, typeof Clock> = {
  dashboard: LayoutDashboard,
  clock: Clock,
  plane: Plane,
  users: Users,
  user: User,
  receipt: Receipt,
  banknote: Banknote,
  shield: Shield,
};

const linkBase = "flex items-center gap-3 rounded-l-full py-2.5 pl-4 pr-3 text-sm transition-colors";
const linkIdle = "text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground";
// The active item is the content panel's color, so it visually merges into the panel.
const linkActive = "bg-background font-medium text-accent";

function Menu_({
  groups, pathname, onNavigate, signOut, name, settingsActive,
}: {
  groups: NavGroup[]; pathname: string; onNavigate?: () => void;
  signOut: () => Promise<void>; name: string; settingsActive: boolean;
}) {
  const current = activeHref(pathname, allHrefs(groups));
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-1 overflow-y-auto py-2 pl-3">
        {groups.map((g) => {
          const Icon = icons[g.icon];
          if (g.href) {
            return (
              <Link key={g.label} href={g.href} onClick={onNavigate}
                aria-current={current === g.href ? "page" : undefined}
                className={cn(linkBase, current === g.href ? linkActive : linkIdle)}>
                <Icon size={18} /> {g.label}
              </Link>
            );
          }
          const items = g.items ?? [];
          const hasActive = items.some((i) => i.href === current);
          const open = toggled[g.label] ?? hasActive;
          return (
            <div key={g.label}>
              <button type="button" aria-expanded={open}
                onClick={() => setToggled((t) => ({ ...t, [g.label]: !open }))}
                className={cn(linkBase, "w-full", hasActive && !open ? "text-sidebar-foreground" : linkIdle)}>
                <Icon size={18} />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="mt-1 space-y-1">
                  {items.map((i) => (
                    <Link key={i.href} href={i.href} onClick={onNavigate}
                      aria-current={current === i.href ? "page" : undefined}
                      className={cn(linkBase, "!pl-11", current === i.href ? linkActive : linkIdle)}>
                      {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/15 py-3 pl-3">
        <Link href="/settings" onClick={onNavigate}
          aria-current={settingsActive ? "page" : undefined}
          className={cn(linkBase, settingsActive ? linkActive : linkIdle)}>
          <Settings size={18} /> Settings
        </Link>
        <form action={signOut} className="pr-3">
          <button className="flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground">
            <LogOut size={18} /> Log out
          </button>
        </form>
        <span className="sr-only">Signed in as {name}</span>
      </div>
    </div>
  );
}

export function AppShell({
  groups, name, roleLabel, signOut, children,
}: {
  groups: NavGroup[]; name: string; roleLabel: string;
  signOut: () => Promise<void>; children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Keyed by pathname: the drawer closes by itself whenever the page changes.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const drawerOpen = openFor === pathname;
  const settingsActive = pathname === "/settings";

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <Logo size={40} />
      <div>
        <p className="text-lg font-semibold leading-tight text-sidebar-foreground">Z-Fast HRIS</p>
        <p className="text-xs text-sidebar-muted">{roleLabel}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-sidebar md:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col print:hidden md:flex">
        {brand}
        <div className="min-h-0 flex-1">
          <Menu_ groups={groups} pathname={pathname} signOut={signOut} name={name} settingsActive={settingsActive} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between px-4 py-3 print:hidden md:hidden">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <p className="font-semibold text-sidebar-foreground">Z-Fast HRIS</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" aria-label="Settings"><Avatar name={name} className="h-8 w-8 text-xs" /></Link>
          <button type="button" aria-label="Open menu" onClick={() => setOpenFor(pathname)}
            className="rounded-lg p-2 text-sidebar-foreground hover:bg-white/10">
            <Menu size={20} />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden print:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50"
            onClick={() => setOpenFor(null)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button type="button" aria-label="Close menu" onClick={() => setOpenFor(null)}
                className="rounded-lg p-2 text-sidebar-foreground hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Menu_ groups={groups} pathname={pathname} onNavigate={() => setOpenFor(null)}
                signOut={signOut} name={name} settingsActive={settingsActive} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col print:m-0">
        <div className="flex-1 rounded-t-3xl bg-background print:rounded-none md:mb-0 md:mt-3 md:rounded-l-3xl md:rounded-tr-none">
          <div className="hidden items-center justify-between px-8 pt-5 print:hidden md:flex">
            <p className="text-sm text-muted">Z-Fast HRIS <span className="mx-1">|</span> {roleLabel}</p>
            <Link href="/settings" className="flex items-center gap-2 text-sm" aria-label="Settings">
              <span className="text-muted">{name}</span>
              <Avatar name={name} />
            </Link>
          </div>
          <main className="p-4 md:p-8 md:pt-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
