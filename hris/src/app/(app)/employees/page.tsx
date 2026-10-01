import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords, canViewDirectory } from "@/lib/roles";
import { employmentStatuses, employmentTypes, label } from "@/lib/employees";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  employee_no: string;
  full_name: string;
  employment_type: string;
  status: string;
  departments: { name: string } | null;
  positions: { title: string } | null;
};

const statusColor: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  ON_LEAVE: "bg-warning/15 text-warning",
  RESIGNED: "bg-muted/15 text-muted",
  TERMINATED: "bg-danger/15 text-danger",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; status?: string; type?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me || !canViewDirectory(me.role)) notFound();

  const { q, dept, status, type } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("employees")
    .select("id, employee_no, full_name, employment_type, status, departments(name), positions(title)")
    .order("full_name");
  const term = q?.replace(/[,()%*]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,employee_no.ilike.%${term}%`);
  if (dept) query = query.eq("department_id", dept);
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("employment_type", type);

  const [{ data }, { data: departments }] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  const field =
    "rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Employees</h1>
        {canManageRecords(me.role) && (
          <Link
            href="/employees/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            Add employee
          </Link>
        )}
      </div>

      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or no." className={cn(field, "w-56")} />
        <select name="dept" defaultValue={dept ?? ""} className={field}>
          <option value="">All departments</option>
          {(departments ?? []).map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </select>
        <select name="status" defaultValue={status ?? ""} className={field}>
          <option value="">Any status</option>
          {employmentStatuses.map((s) => (<option key={s} value={s}>{label(s)}</option>))}
        </select>
        <select name="type" defaultValue={type ?? ""} className={field}>
          <option value="">Any type</option>
          {employmentTypes.map((t) => (<option key={t} value={t}>{label(t)}</option>))}
        </select>
        <button className="rounded-lg bg-surface-raised px-3 py-1.5 text-sm hover:bg-border">Filter</button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                <td className="px-4 py-3 text-muted">{r.employee_no}</td>
                <td className="px-4 py-3">
                  <Link href={`/employees/${r.id}`} className="text-accent hover:underline">{r.full_name}</Link>
                </td>
                <td className="px-4 py-3">{r.departments?.name ?? "—"}</td>
                <td className="px-4 py-3">{r.positions?.title ?? "—"}</td>
                <td className="px-4 py-3">{label(r.employment_type)}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", statusColor[r.status])}>
                    {label(r.status)}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">No employees found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
