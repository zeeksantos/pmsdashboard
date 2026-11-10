"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { NavLinks } from "./NavLinks";

interface AppShellProps {
  items: NavItem[];
  userLabel: string;
  signOutButton: React.ReactNode;
  children: React.ReactNode;
  /** Sidebar title; analytics workspaces show their own brand here. */
  title?: React.ReactNode;
  /** Extra content under the title (e.g. a workspace switcher). */
  sidebarHeader?: React.ReactNode;
  /** Full-width notice above the page content (e.g. licence status). */
  banner?: React.ReactNode;
}

export function AppShell({
  items,
  userLabel,
  signOutButton,
  children,
  title = "PMS Dashboard",
  sidebarHeader,
  banner,
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 print:hidden! flex-col gap-1 border-r border-border bg-surface p-3 md:flex">
        <div className="px-3 py-4 text-lg font-semibold text-foreground">{title}</div>
        {sidebarHeader && <div className="px-3 pb-3">{sidebarHeader}</div>}
        <div className="flex flex-1 flex-col gap-1">
          <NavLinks items={items} />
        </div>
        <div className="border-t border-border px-3 pt-3 text-xs text-muted">
          <div className="mb-2 truncate">{userLabel}</div>
          {signOutButton}
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 print:hidden items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <span className="min-w-0 truncate text-base font-semibold text-foreground">{title}</span>
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(true)}
          className="rounded-md p-2 text-muted hover:bg-surface-raised hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-1 bg-surface p-3 shadow-xl">
            <div className="flex items-center justify-between px-3 py-4">
              <span className="min-w-0 truncate text-lg font-semibold text-foreground">{title}</span>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-md p-1 text-muted hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarHeader && <div className="px-3 pb-3">{sidebarHeader}</div>}
            <div className="flex flex-1 flex-col gap-1">
              <NavLinks items={items} onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
            <div className="border-t border-border px-3 pt-3 text-xs text-muted">
              <div className="mb-2 truncate">{userLabel}</div>
              {signOutButton}
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 pt-14 md:pt-0 print:pt-0">
        {banner && <div className="print:hidden">{banner}</div>}
        <div className="mx-auto max-w-6xl p-4 md:p-8 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
