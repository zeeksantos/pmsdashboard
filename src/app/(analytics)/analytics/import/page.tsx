import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { CHANNEL_LABELS } from "@/lib/analytics/importers";
import { formatManilaDateTime } from "@/lib/format";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { ImportWizard } from "./ImportWizard";
import { DeleteImportButton } from "./DeleteImportButton";

const HOW_TO = [
  {
    channel: "Airbnb",
    steps:
      "Menu → Earnings → Transaction history (Paid / completed payouts) → Export CSV. Pick a date range and include all listings. Co-hosts can export the same report from their own account.",
  },
  {
    channel: "Booking.com",
    steps:
      "Extranet → Reservations → set the date range → Download. If the download is an Excel file, open it and Save As → CSV.",
  },
  {
    channel: "Agoda",
    steps: "YCS → Bookings → search the date range → Export. Save it as CSV if it downloads as Excel.",
  },
  {
    channel: "Anything else",
    steps:
      "Any CSV with one row per booking works — check-in, check-out and an amount are enough. You'll match the columns once.",
  },
];

export default async function ImportPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const { data: imports } = await supabase
    .from("an_imports")
    .select("*")
    .eq("workspace_id", ws.workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upload exports"
        description="Upload earnings exports whenever you like — overlapping date ranges are fine, rows you've already uploaded are skipped."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {ws.canEdit ? (
            <ImportWizard baseCurrency={ws.workspace.base_currency} />
          ) : (
            <EmptyState>
              {ws.license.state === "expired"
                ? "Your licence has expired, so new uploads are paused. Your existing data is still here."
                : "You have view-only access to this workspace."}
            </EmptyState>
          )}
        </div>
        <Card title="Where to find your exports" className="lg:col-span-2">
          <dl className="flex flex-col gap-3 text-sm">
            {HOW_TO.map((h) => (
              <div key={h.channel}>
                <dt className="font-medium text-foreground">{h.channel}</dt>
                <dd className="mt-0.5 text-muted">{h.steps}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title="Upload history">
        {!imports?.length ? (
          <p className="text-sm text-muted">Nothing uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium">Channel</th>
                  <th className="pb-2 font-medium">Covers</th>
                  <th className="pb-2 text-right font-medium">Added</th>
                  <th className="pb-2 text-right font-medium">Already had</th>
                  <th className="pb-2 font-medium">Uploaded</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="max-w-[220px] truncate py-2 text-foreground" title={i.file_name}>
                      {i.file_name}
                    </td>
                    <td className="py-2">{CHANNEL_LABELS[i.channel]}</td>
                    <td className="py-2 text-muted">
                      {i.period_start ? `${i.period_start} → ${i.period_end}` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{i.inserted_count}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{i.duplicate_count}</td>
                    <td className="py-2 text-muted">{formatManilaDateTime(i.created_at)}</td>
                    <td className="py-2 text-right">
                      {ws.canEdit && <DeleteImportButton id={i.id} fileName={i.file_name} rows={i.inserted_count} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
