import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupWorkspace, licenseStatus } from "@/lib/analytics/workspace";
import { formatManilaDate, formatManilaDateTime } from "@/lib/format";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { Kpi, KpiGrid } from "@/components/analytics/Kpi";
import { LicenseForm } from "./LicenseForm";

const BADGE = {
  trial: "bg-accent/15 text-accent",
  active: "bg-success/15 text-success",
  expiring: "bg-warning/15 text-warning",
  expired: "bg-danger/15 text-danger",
} as const;

export default async function AdminPage() {
  const ws = await lookupWorkspace();
  if (ws.status === "signed_out" || !ws.isPlatformAdmin) notFound();

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("an_admin_workspaces");
  const list = (rows ?? []).map((r) => ({ ...r, license: licenseStatus(r) }));
  const count = (s: string) => list.filter((r) => r.license.state === s).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Every workspace on the platform. Record a payment to activate or renew a licence (one-time fee = 1 year)."
      />
      <KpiGrid>
        <Kpi label="Workspaces" value={String(list.length)} />
        <Kpi label="On trial" value={String(count("trial"))} />
        <Kpi label="Paid & active" value={String(count("active") + count("expiring"))} sub={`${count("expiring")} renew within 30 days`} />
        <Kpi label="Expired" value={String(count("expired"))} />
      </KpiGrid>
      {error && <p className="text-sm text-danger">{error.message}</p>}
      {list.length === 0 ? (
        <EmptyState>No customers yet.</EmptyState>
      ) : (
        list.map((r) => (
          <Card
            key={r.id}
            title={r.name}
            description={`${r.owner_email ?? "no owner"} · ${r.kind === "manager" ? "Property manager" : "Host"} · joined ${formatManilaDate(r.created_at)}`}
            actions={
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[r.license.state]}`}>
                {r.license.state === "trial" ? "Trial" : r.license.state === "expired" ? "Expired" : "Paid"} · until{" "}
                {formatManilaDate(r.license.until)}
              </span>
            }
          >
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
              <span>{r.member_count} member{r.member_count === 1 ? "" : "s"}</span>
              <span>{r.unit_count} units</span>
              <span>{Number(r.transaction_count).toLocaleString()} transactions</span>
              <span>Last upload: {r.last_import_at ? formatManilaDateTime(r.last_import_at) : "never"}</span>
            </div>
            <LicenseForm workspaceId={r.id} isPaid={r.license.isPaid} />
          </Card>
        ))
      )}
    </div>
  );
}
