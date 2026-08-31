import { createClient } from "@/lib/supabase/server";
import { formatManilaDateTime } from "@/lib/format";
import { HOUSEKEEPING_TASK_STATUS_STYLES } from "@/lib/status-colors";
import { StatusBadge } from "@/components/StatusBadge";
import { UnitStatusSelect } from "../units/UnitStatusSelect";
import { TaskActions } from "./TaskActions";

export default async function HousekeepingPage() {
  const supabase = await createClient();

  const [{ data: tasks, error }, { data: units }, { data: profiles }] = await Promise.all([
    supabase.from("housekeeping_tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("units").select("*").order("name", { ascending: true }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const activeTasks = (tasks ?? []).filter((t) => t.status !== "COMPLETED");
  const recentCompleted = (tasks ?? [])
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Housekeeping</h1>
      <p className="mt-1 text-sm text-muted">
        Task queue driven by checkout — completing a task automatically frees the unit for the
        next guest.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Task Queue</h2>

      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load tasks: {error.message}
        </div>
      )}

      {!error && activeTasks.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No pending or in-progress tasks. Checking out a guest creates one automatically.
        </div>
      )}

      {!error && activeTasks.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeTasks.map((task) => (
                <tr key={task.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {unitById.get(task.unit_id)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatManilaDateTime(task.created_at)}</td>
                  <td className="px-4 py-3 text-muted">
                    {task.assigned_to ? (profileById.get(task.assigned_to)?.full_name ?? "—") : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={task.status.replace("_", " ")}
                      className={HOUSEKEEPING_TASK_STATUS_STYLES[task.status]}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <TaskActions taskId={task.id} status={task.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recentCompleted.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
            Recently completed ({recentCompleted.length})
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {recentCompleted.map((task) => (
              <div key={task.id} className="flex justify-between text-sm text-muted">
                <span>{unitById.get(task.unit_id)?.name ?? "—"}</span>
                <span>{task.completed_at ? formatManilaDateTime(task.completed_at) : "—"}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <h2 className="mt-10 text-lg font-semibold text-foreground">Room Status Board</h2>
      <p className="mt-1 text-sm text-muted">
        DIRTY → CLEANING → AVAILABLE. Changes here are visible immediately on Units & Rates and
        the Calendar.
      </p>

      {units && units.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <div className="font-medium text-foreground">{unit.name}</div>
                <div className="text-xs text-muted">{unit.unit_type}</div>
              </div>
              <UnitStatusSelect unitId={unit.id} status={unit.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
