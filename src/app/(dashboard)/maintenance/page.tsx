import { createClient } from "@/lib/supabase/server";
import { formatManilaDateTime } from "@/lib/format";
import { MAINTENANCE_PRIORITY_STYLES } from "@/lib/status-colors";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketFormDialog } from "./TicketFormDialog";
import { TicketStatusSelect } from "./TicketStatusSelect";
import { DeleteTicketButton } from "./DeleteTicketButton";

const STATUS_ORDER = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2, CLOSED: 3 } as const;
const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export default async function MaintenancePage() {
  const supabase = await createClient();

  const [{ data: tickets, error }, { data: units }, { data: technicians }] = await Promise.all([
    supabase.from("maintenance_tickets").select("*"),
    supabase.from("units").select("id, name").order("name", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("role", "maintenance"),
  ]);

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const technicianById = new Map((technicians ?? []).map((t) => [t.id, t]));

  const sortedTickets = (tickets ?? []).sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.created_at.localeCompare(b.created_at);
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Maintenance</h1>
          <p className="mt-1 text-sm text-muted">
            Trackable tickets for property issues — created manually or as needed, not tied to
            any automation.
          </p>
        </div>
        <TicketFormDialog units={units ?? []} technicians={technicians ?? []} />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load tickets: {error.message}
        </div>
      )}

      {!error && sortedTickets.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No maintenance tickets yet.
        </div>
      )}

      {!error && sortedTickets.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{ticket.title}</td>
                  <td className="px-4 py-3 text-muted">{unitById.get(ticket.unit_id)?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={ticket.priority}
                      className={MAINTENANCE_PRIORITY_STYLES[ticket.priority]}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {ticket.assigned_to ? (technicianById.get(ticket.assigned_to)?.full_name ?? "—") : "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatManilaDateTime(ticket.created_at)}</td>
                  <td className="px-4 py-3">
                    <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <TicketFormDialog ticket={ticket} units={units ?? []} technicians={technicians ?? []} />
                      <DeleteTicketButton ticketId={ticket.id} title={ticket.title} />
                    </div>
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
