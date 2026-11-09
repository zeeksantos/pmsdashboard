"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { switchWorkspace } from "./actions";

export interface TopBarLink {
  href: string;
  label: string;
}

export function TopBar({
  brand,
  links,
  workspaces,
  currentWorkspace,
  email,
  pmsLink,
}: {
  brand: React.ReactNode;
  links: TopBarLink[];
  workspaces: { id: string; name: string }[];
  currentWorkspace: string | null;
  email: string | null;
  pmsLink: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="topbar">
      <div className="topbar-in">
        <span className="brand">{brand}</span>
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
        {workspaces.length > 1 && currentWorkspace && (
          <select
            aria-label="Switch workspace"
            value={currentWorkspace}
            disabled={pending}
            onChange={(e) => start(() => switchWorkspace(e.target.value))}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        {pmsLink && <Link href="/">PMS</Link>}
        {email && <span style={{ opacity: 0.7 }}>{email}</span>}
        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
