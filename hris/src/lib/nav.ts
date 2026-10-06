export type NavIcon = "dashboard" | "clock" | "plane" | "users" | "user" | "receipt" | "banknote" | "shield";

export type NavLink = { href: string; label: string };

// A menu entry is either a single link (href) or a dropdown group (items).
export type NavGroup = { label: string; icon: NavIcon; href?: string; items?: NavLink[] };

// Which menu link is "current" for a path. The most specific (longest) matching link wins, so on
// /leave/approvals the "Leave Approvals" link is current, not "My Leave".
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

// A group with a single item is shown as a plain link instead of a one-item dropdown.
export function simplifyGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .filter((g) => g.href || (g.items && g.items.length > 0))
    .map((g) =>
      !g.href && g.items && g.items.length === 1
        ? { label: g.items[0].label, icon: g.icon, href: g.items[0].href }
        : g
    );
}

export function allHrefs(groups: NavGroup[]): string[] {
  return groups.flatMap((g) => (g.href ? [g.href] : (g.items ?? []).map((i) => i.href)));
}
