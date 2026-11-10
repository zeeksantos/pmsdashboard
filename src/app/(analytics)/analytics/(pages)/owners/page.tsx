import Link from "next/link";
import { FileText } from "lucide-react";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio } from "@/lib/analytics/data";
import { labelMonth, ownerStatement, shiftMonth } from "@/lib/analytics/metrics";
import { getManilaToday } from "@/lib/calendar";
import { formatMoney } from "@/lib/format";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { ConfirmButton } from "@/components/analytics/ConfirmButton";
import { secondaryButton } from "@/components/analytics/ui";
import { OwnerDialog } from "./OwnerDialog";
import { deleteOwner } from "./actions";

export default async function OwnersPage() {
  const ws = await requireWorkspace();
  const lastMonth = shiftMonth(getManilaToday().slice(0, 7), -1);
  const { portfolio: p, owners, units } = await loadPortfolio(ws.workspace.id, { from: lastMonth, to: lastMonth });
  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Owners & statements"
        description="Assign units to owners on the Units page, set each owner's management fee, then print or save a branded monthly statement as PDF."
        actions={ws.canEdit && <OwnerDialog />}
      />

      {owners.length === 0 ? (
        <EmptyState>Add the property owners you manage units for.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {owners.map((o) => {
            const owned = units.filter((u) => u.owner_id === o.id);
            const st = ownerStatement(p, o.id, lastMonth, Number(o.management_fee_pct));
            return (
              <Card
                key={o.id}
                title={o.name}
                description={[o.email, `${Number(o.management_fee_pct)}% management fee`].filter(Boolean).join(" · ")}
                actions={
                  ws.canEdit && (
                    <span className="flex items-center">
                      <OwnerDialog owner={o} />
                      <ConfirmButton
                        action={deleteOwner.bind(null, o.id)}
                        label={`Delete ${o.name}`}
                        confirmText={`Delete ${o.name}? Their units stay, just without an owner.`}
                      />
                    </span>
                  )
                }
              >
                <div className="text-sm text-muted">
                  {owned.length === 0 ? (
                    <>
                      No units yet —{" "}
                      <Link href="/analytics/units" className="text-accent hover:underline">
                        assign units
                      </Link>
                      .
                    </>
                  ) : (
                    owned.map((u) => u.name).join(", ")
                  )}
                </div>
                {owned.length > 0 && (
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted">{labelMonth(lastMonth)} earnings</dt>
                      <dd className="tabular-nums text-foreground">{money(st.totals.netEarnings)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Your fee</dt>
                      <dd className="tabular-nums text-foreground">{money(st.totals.managementFee)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Due to owner</dt>
                      <dd className={`tabular-nums ${st.totals.dueToOwner < 0 ? "text-danger" : "text-foreground"}`}>
                        {money(st.totals.dueToOwner)}
                      </dd>
                    </div>
                  </dl>
                )}
                <Link href={`/analytics/owners/${o.id}/statement?month=${lastMonth}`} className={`${secondaryButton} mt-4`}>
                  <FileText className="h-4 w-4" /> Monthly statement
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
