import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { logoUrl, SALES_CONTACT } from "@/lib/analytics/branding";
import { formatManilaDate, formatPeso } from "@/lib/format";
import { PageHeader, Card } from "@/components/analytics/PageHeader";
import { BrandingForm } from "./BrandingForm";
import { Members } from "./Members";

const STATE_LABEL = {
  trial: "Free trial",
  active: "Active",
  expiring: "Active — renewal due soon",
  expired: "Expired (read-only)",
} as const;

export default async function SettingsPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const [{ data: members }, { data: invites }, { data: events }] = await Promise.all([
    supabase.rpc("an_workspace_member_list", { p_workspace: ws.workspace.id }),
    supabase.from("workspace_invites").select("*").eq("workspace_id", ws.workspace.id).order("created_at"),
    ws.isOwner
      ? supabase.from("an_license_events").select("*").eq("workspace_id", ws.workspace.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const { license, workspace } = ws;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />

      <Card title="Licence">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Status</dt>
            <dd className={license.state === "expired" ? "text-danger" : "text-foreground"}>{STATE_LABEL[license.state]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{license.isPaid ? "Paid through" : "Trial ends"}</dt>
            <dd className="text-foreground">{formatManilaDate(license.until)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Renewal</dt>
            <dd className="text-foreground">{SALES_CONTACT}</dd>
          </div>
        </dl>
        {events && events.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span className="text-foreground">
                  {e.kind === "trial_extended" ? `Trial extended ${e.days} days` : `${e.kind === "activated" ? "Activated" : "Renewed"} for ${e.years} year${e.years === 1 ? "" : "s"}`}
                  {e.amount != null && <span className="text-muted"> · {formatPeso(Number(e.amount))}</span>}
                </span>
                <span className="text-muted">{formatManilaDate(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Business & branding" description="Your logo and colours appear in the app and on owner statements — your customers never see ours.">
        {ws.isOwner ? (
          <BrandingForm workspace={workspace} logo={logoUrl(workspace.brand_logo_path)} />
        ) : (
          <p className="text-sm text-muted">Only the workspace owner can change these.</p>
        )}
      </Card>

      <Card title="People" description="Invite a business partner, accountant or staff member. Viewers can see everything but change nothing.">
        <Members members={members ?? []} invites={invites ?? []} me={ws.userId} isOwner={ws.isOwner} />
      </Card>
    </div>
  );
}
