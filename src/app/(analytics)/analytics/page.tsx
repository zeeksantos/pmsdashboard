import Link from "next/link";
import { lookupWorkspace } from "@/lib/analytics/workspace";
import { loadReport, periodOptions, resolvePeriod } from "@/lib/analytics/data";
import { brandName, PRODUCT_NAME } from "@/lib/analytics/branding";
import { toManilaDateString } from "@/lib/calendar";
import { Dashboard } from "@/components/analytics/dash/Dashboard";
import type { DashCosts } from "@/components/analytics/dash/types";
import { OnboardingForm } from "./OnboardingForm";

const fmtDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ws = await lookupWorkspace();

  if (ws.status === "no_workspace") {
    return (
      <main className="page">
        <div className="panel">
          <h1>Welcome to {PRODUCT_NAME}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Upload your Airbnb, Booking.com or Agoda earnings exports and see occupancy, nightly rates, expenses and profit for every unit. Your
            first 14 days are free.
          </p>
          <OnboardingForm />
          <p className="note">
            Invited by someone? Ask them to invite <b>{ws.email}</b> from their Settings page, then refresh.
          </p>
        </div>
      </main>
    );
  }
  if (ws.status !== "ok") return null;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const period = resolvePeriod(one(sp.period));
  const currency = ws.workspace.base_currency;
  const data = await loadReport(ws.workspace.id, period, currency);
  const { report } = data;

  if (!data.lastImportAt) {
    return (
      <main className="page">
        <div className="panel">
          <h1>{brandName(ws.workspace)}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            No data yet. Upload your first earnings export — Airbnb&apos;s transaction history CSV, or a Booking.com / Agoda reservations export — and
            this page fills in with the full dashboard: earnings, occupancy, every unit, monthly income, break-even, co-host shares, refunds and every
            transaction.
          </p>
          {ws.canEdit ? (
            <p style={{ marginTop: 16 }}>
              <Link className="btn dark" href="/analytics/import">
                Upload an export
              </Link>
            </p>
          ) : (
            <p className="note">Ask the workspace owner to upload an export.</p>
          )}
        </div>
      </main>
    );
  }

  const costs: DashCosts = {
    fixed: data.fixedCosts,
    monthly: data.monthlyCosts,
    receipts: data.expenses.map((e) => ({ unit_id: e.unit_id, month: e.spent_on.slice(0, 7), amount: Number(e.amount) })),
  };
  const uploaded = toManilaDateString(data.lastImportAt);
  const generated = report.hasData
    ? `Data through ${fmtDay(report.window.end)} · last upload ${fmtDay(uploaded)}`
    : `No transactions in ${period.label.toLowerCase()} · last upload ${fmtDay(uploaded)}`;

  return (
    <Dashboard
      key={period.key}
      report={report}
      brand={brandName(ws.workspace)}
      periodKey={period.key}
      periodOptions={periodOptions().map((o) => ({ key: o.key, label: o.label }))}
      generated={generated}
      currency={currency}
      canEdit={ws.canEdit}
      costs={costs}
      hasUploads
      initialTab={one(sp.tab) ?? "overview"}
      initialUnit={one(sp.unit) ?? null}
    />
  );
}
