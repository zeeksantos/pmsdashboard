import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewDirectory } from "@/lib/roles";

type Row = {
  id: string;
  full_name: string;
  reports_to: string | null;
  positions: { title: string } | null;
  departments: { name: string } | null;
};

function Node({ row, byManager }: { row: Row; byManager: Map<string | null, Row[]> }) {
  const reports = byManager.get(row.id) ?? [];
  return (
    <li className="mt-2">
      <Link
        href={`/employees/${row.id}`}
        className="inline-block rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
      >
        <span className="font-medium">{row.full_name}</span>
        <span className="block text-xs text-muted">
          {[row.positions?.title, row.departments?.name].filter(Boolean).join(" · ") || "—"}
        </span>
      </Link>
      {reports.length > 0 && (
        <ul className="ml-4 border-l border-border pl-4">
          {reports.map((r) => (<Node key={r.id} row={r} byManager={byManager} />))}
        </ul>
      )}
    </li>
  );
}

export default async function OrgChartPage() {
  const me = await getCurrentUser();
  if (!me || !canViewDirectory(me.role)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, reports_to, positions(title), departments(name)")
    .eq("status", "ACTIVE")
    .order("full_name");
  const rows = (data ?? []) as unknown as Row[];

  const ids = new Set(rows.map((r) => r.id));
  const byManager = new Map<string | null, Row[]>();
  for (const r of rows) {
    // Anyone whose manager isn't active (or is unset) shows at the top level.
    const key = r.reports_to && ids.has(r.reports_to) ? r.reports_to : null;
    byManager.set(key, [...(byManager.get(key) ?? []), r]);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Org Chart</h1>
      <p className="mt-1 text-sm text-muted">Active employees, grouped by who they report to.</p>
      <ul className="mt-4">
        {(byManager.get(null) ?? []).map((r) => (<Node key={r.id} row={r} byManager={byManager} />))}
        {!rows.length && <li className="text-sm text-muted">No employees yet.</li>}
      </ul>
    </div>
  );
}
