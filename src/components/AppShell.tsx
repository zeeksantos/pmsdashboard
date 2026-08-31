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
}

export function AppShell({ items, userLabel, signOutButton, children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 md:flex">
        <div className="px-3 py-4 text-lg font-semibold text-foreground">PMS Dashboard</div>
        <div className="flex flex-1 flex-col gap-1">
          <NavLinks items={items} />
        </div>
        <div className="border-t border-border px-3 pt-3 text-xs text-muted">
          <div className="mb-2 truncate">{userLabel}</div>
          {signOutButton}
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <span className="text-base font-semibold text-foreground">PMS Dashboard</span>
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
              <span className="text-lg font-semibold text-foreground">PMS Dashboard</span>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-md p-1 text-muted hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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

      <main className="min-w-0 flex-1 pt-14 md:pt-0">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
