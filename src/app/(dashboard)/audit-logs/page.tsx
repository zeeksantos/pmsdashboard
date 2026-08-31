import { createClient } from "@/lib/supabase/server";
import { formatManilaDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { DetailsToggle } from "@/components/DetailsToggle";

const RESOURCE_TYPES = [
  "profiles",
  "units",
  "guests",
  "bookings",
  "payments",
  "housekeeping_tasks",
  "maintenance_tickets",
];

const ACTION_STYLES: Record<string, string> = {
  INSERT: "bg-success/15 text-success",
  UPDATE: "bg-accent/15 text-accent",
  DELETE: "bg-danger/15 text-danger",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string }>;
}) {
  const { resource } = await searchParams;
  const supabase = await createClient();

  let request = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (resource) {
    request = request.eq("resource_type", resource);
  }

  const { data: logs, error } = await request;

  const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter((id): id is string => !!id))];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
      <p className="mt-1 text-sm text-muted">
        Immutable record of every mutation — user, role, action, resource, timestamp, details.
        Showing the most recent 200 entries.
      </p>

      <form action="/audit-logs" method="get" className="mt-6 flex items-center gap-3">
        <label htmlFor="resource" className="text-sm text-muted">
          Filter by resource
        </label>
        <select
          id="resource"
          name="resource"
          defaultValue={resource ?? ""}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        >
          <option value="">All resources</option>
          {RESOURCE_TYPES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Apply
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load audit logs: {error.message}
        </div>
      )}

      {!error && logs && logs.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No audit entries match this filter.
        </div>
      )}

      {!error && logs && logs.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {formatManilaDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {log.user_id ? (profileById.get(log.user_id) ?? "—") : "System"}
                  </td>
                  <td className="px-4 py-3 text-muted">{log.user_role ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={log.action} className={ACTION_STYLES[log.action]} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {log.resource_type}
                    {log.resource_id && (
                      <span className="text-xs"> · {log.resource_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DetailsToggle details={log.details} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
