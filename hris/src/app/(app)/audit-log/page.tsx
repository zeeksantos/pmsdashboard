import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewAuditLog } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { changes, recordName, resourceLabels, show, snapshot, type AuditRow } from "@/lib/audit";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 50;

const actionColor: Record<string, string> = {
  INSERT: "bg-success/15 text-success",
  UPDATE: "bg-accent/15 text-accent",
  DELETE: "bg-danger/15 text-danger",
};
const actionLabel: Record<string, string> = { INSERT: "Created", UPDATE: "Updated", DELETE: "Deleted" };

type Params = { resource?: string; action?: string; from?: string; to?: string; page?: string };
const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

function Details({ row }: { row: AuditRow }) {
  const diff = changes(row);
  const fields = Object.entries(snapshot(row)).filter(([, v]) => v !== null && v !== "");
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-accent">
        {row.action === "UPDATE" ? `${diff.length} field${diff.length === 1 ? "" : "s"} changed` : "View record"}
      </summary>
      <div className="mt-2 rounded-lg bg-surface-raised p-3">
        {row.action === "UPDATE" ? (
          diff.length ? (
            <ul className="space-y-1">
              {diff.map((c) => (
                <li key={c.field}>
                  <span className="text-muted">{c.field}:</span> {c.from} → <span className="text-foreground">{c.to}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted">No visible field changes.</span>
          )
        ) : (
          <dl className="space-y-1">
            {fields.map(([k, v]) => (
              <div key={k}>
                <dt className="inline text-muted">{k}: </dt>
                <dd className="inline">{show(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await getCurrentUser();
  if (!me || !canViewAuditLog(me.role)) notFound();

  const p = await searchParams;
  const page = Math.max(1, Number(p.page) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, at, user_id, role, action, resource, resource_id, details", { count: "exact" })
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (p.resource && resourceLabels[p.resource]) query = query.eq("resource", p.resource);
  if (p.action && actionLabel[p.action]) query = query.eq("action", p.action);
  if (isDate(p.from)) query = query.gte("at", `${p.from}T00:00:00+08:00`);
  if (isDate(p.to)) {
    const next = new Date(`${p.to}T00:00:00+08:00`);
    next.setDate(next.getDate() + 1);
    query = query.lt("at", next.toISOString());
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as AuditRow[];

  // Map login ids to employee names.
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: emps } = await supabase.from("employees").select("user_id, full_name").in("user_id", userIds);
    for (const e of emps ?? []) if (e.user_id) names.set(e.user_id, e.full_name);
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (n: number) => {
    const q = new URLSearchParams();
    for (const k of ["resource", "action", "from", "to"] as const) if (p[k]) q.set(k, p[k]!);
    q.set("page", String(n));
    return `/audit-log?${q}`;
  };

  const field =
    "rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="mt-1 text-sm text-muted">
        Every change to employee data is recorded here and can&apos;t be edited or deleted. Details can
        include sensitive fields, so keep this page to admins and owners.
      </p>

      <form className="mt-4 flex flex-wrap items-center gap-2">
        <select name="resource" defaultValue={p.resource ?? ""} className={field}>
          <option value="">All records</option>
          {Object.entries(resourceLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        <select name="action" defaultValue={p.action ?? ""} className={field}>
          <option value="">Any action</option>
          {Object.entries(actionLabel).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        <input type="date" name="from" defaultValue={p.from} aria-label="From date" className={field} />
        <span className="text-sm text-muted">to</span>
        <input type="date" name="to" defaultValue={p.to} aria-label="To date" className={field} />
        <button className="rounded-lg bg-surface-raised px-3 py-1.5 text-sm hover:bg-border">Filter</button>
        <Link href="/audit-log" className="text-sm text-muted hover:text-foreground">Reset</Link>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">When (Manila)</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Record</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r.at)}</td>
                <td className="px-4 py-3">
                  {r.user_id ? (names.get(r.user_id) ?? `User ${r.user_id.slice(0, 8)}`) : "System"}
                  {r.role && <span className="block text-xs text-muted">{r.role}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", actionColor[r.action])}>
                    {actionLabel[r.action]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {resourceLabels[r.resource] ?? r.resource}
                  {recordName(r) && <span className="block text-xs text-muted">{recordName(r)}</span>}
                </td>
                <td className="px-4 py-3"><Details row={r} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">No log entries match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{total} entr{total === 1 ? "y" : "ies"} · page {page} of {pages}</span>
        <div className="flex gap-3">
          {page > 1 && <Link href={link(page - 1)} className="hover:text-foreground">← Newer</Link>}
          {page < pages && <Link href={link(page + 1)} className="hover:text-foreground">Older →</Link>}
        </div>
      </div>
    </div>
  );
}
