import { redirect } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { lookupWorkspace } from "@/lib/analytics/workspace";
import { brandName, logoUrl, PRODUCT_NAME, SALES_CONTACT } from "@/lib/analytics/branding";
import { formatManilaDate } from "@/lib/format";
import { TopBar, type TopBarLink } from "./TopBar";
import "./analytics.css";

export const dynamic = "force-dynamic";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <div className={`an ${jakarta.variable}`}>
        <main className="page">
          <div className="empty">
            Supabase isn&apos;t configured yet. Add the Supabase keys and apply the migrations in{" "}
            <code>supabase/migrations/</code>.
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Join any workspace that invited this e-mail before resolving the current one.
  await supabase.rpc("an_accept_invites");

  const [ws, { data: profile }] = await Promise.all([
    lookupWorkspace(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  const isPmsStaff = Boolean(profile && profile.role !== "analytics_only");

  if (ws.status !== "ok") {
    return (
      <div className={`an ${jakarta.variable}`}>
        <TopBar
          brand={PRODUCT_NAME}
          links={[]}
          workspaces={[]}
          currentWorkspace={null}
          email={user.email ?? null}
          pmsLink={isPmsStaff}
        />
        <main className="page">{children}</main>
      </div>
    );
  }

  const { workspace, license } = ws;
  const logo = logoUrl(workspace.brand_logo_path);
  const name = brandName(workspace);
  const brand = (
    <>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" />
      ) : (
        <span className="mark" style={{ background: workspace.brand_color ?? "#0e8c8e" }} aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {name}
    </>
  );

  const links: TopBarLink[] = [
    { href: "/analytics", label: "Dashboard" },
    { href: "/analytics/import", label: "Upload exports" },
    { href: "/analytics/direct", label: "Direct bookings" },
    { href: "/analytics/units", label: "Unit setup" },
    { href: "/analytics/expenses", label: "Receipts" },
  ];
  if (workspace.kind === "manager") links.push({ href: "/analytics/owners", label: "Owner statements" });
  links.push({ href: "/analytics/settings", label: "Settings" });
  if (ws.isPlatformAdmin) {
    links.push({ href: "/analytics/admin", label: "Customers" });
    links.push({ href: "/analytics/new", label: "+ New business" });
  }

  let notice: React.ReactNode = null;
  if (license.state === "expired") {
    notice = (
      <div className="notice expired">
        Your licence ended on {formatManilaDate(license.until)}. Your data is safe and still viewable — renew to upload
        new exports or make changes. {SALES_CONTACT}
      </div>
    );
  } else if (license.state === "trial") {
    notice = (
      <div className="notice trial">
        Free trial — {license.daysLeft} day{license.daysLeft === 1 ? "" : "s"} left. A one-time licence includes a full
        year of access. {SALES_CONTACT}
      </div>
    );
  } else if (license.state === "expiring") {
    notice = (
      <div className="notice expiring">
        Your licence renews on {formatManilaDate(license.until)} ({license.daysLeft} days). {SALES_CONTACT}
      </div>
    );
  }

  return (
    <div className={`an ${jakarta.variable}`}>
      <TopBar
        brand={brand}
        links={links}
        workspaces={ws.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name }))}
        currentWorkspace={workspace.id}
        email={user.email ?? null}
        pmsLink={isPmsStaff}
      />
      {notice}
      {children}
    </div>
  );
}
