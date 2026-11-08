import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@/components/SignOutButton";
import { lookupWorkspace } from "@/lib/analytics/workspace";
import { analyticsNav } from "@/lib/analytics/nav";
import { brandName, logoUrl, PRODUCT_NAME, SALES_CONTACT } from "@/lib/analytics/branding";
import { formatManilaDate } from "@/lib/format";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export const dynamic = "force-dynamic";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Supabase isn&apos;t configured yet. Add the Supabase keys to <code className="font-mono">.env.local</code>{" "}
          and apply the migrations in <code className="font-mono">supabase/migrations/</code>.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Join any workspace that invited this e-mail before resolving the
  // current one.
  await supabase.rpc("an_accept_invites");

  const [ws, { data: profile }] = await Promise.all([
    lookupWorkspace(),
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
  ]);
  const isPmsStaff = Boolean(profile && profile.role !== "analytics_only");

  if (ws.status !== "ok") {
    return (
      <div className="min-h-screen">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-8">
          <span className="font-semibold text-foreground">{PRODUCT_NAME}</span>
          <div className="flex items-center gap-3 text-xs text-muted">
            {isPmsStaff && (
              <Link href="/" className="hover:text-foreground">
                ← PMS
              </Link>
            )}
            <span className="hidden sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <div className="mx-auto max-w-3xl p-4 md:p-8">{children}</div>
      </div>
    );
  }

  const { workspace, license } = ws;
  const logo = logoUrl(workspace.brand_logo_path);
  const name = brandName(workspace);

  const title = (
    <span className="flex min-w-0 items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
      ) : (
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm font-bold text-white"
          style={{ background: workspace.brand_color ?? "var(--accent)" }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  );

  let banner: React.ReactNode = null;
  if (license.state === "expired") {
    banner = (
      <div className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm text-danger">
        Your licence ended on {formatManilaDate(license.until)}. Your data is safe and still viewable — renew to
        upload new exports or make changes. {SALES_CONTACT}
      </div>
    );
  } else if (license.state === "trial") {
    banner = (
      <div className="border-b border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-accent">
        Free trial — {license.daysLeft} day{license.daysLeft === 1 ? "" : "s"} left. A one-time licence includes a
        full year of access. {SALES_CONTACT}
      </div>
    );
  } else if (license.state === "expiring") {
    banner = (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
        Your licence renews on {formatManilaDate(license.until)} ({license.daysLeft} days). {SALES_CONTACT}
      </div>
    );
  }

  const sidebarHeader = (
    <div className="flex flex-col gap-2">
      {ws.memberships.length > 1 && (
        <WorkspaceSwitcher
          current={workspace.id}
          options={ws.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name }))}
        />
      )}
      {isPmsStaff && (
        <Link href="/" className="text-xs text-muted hover:text-foreground">
          ← Back to PMS
        </Link>
      )}
    </div>
  );

  return (
    <AppShell
      title={title}
      sidebarHeader={sidebarHeader}
      banner={banner}
      items={analyticsNav(workspace.kind, ws.isPlatformAdmin)}
      userLabel={`${profile?.full_name ?? user.email ?? ""} · ${ws.role}`}
      signOutButton={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
