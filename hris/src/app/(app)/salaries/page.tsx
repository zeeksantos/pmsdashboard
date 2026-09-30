import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewSalaries } from "@/lib/roles";
import { formatPeso, manilaToday } from "@/lib/format";
import { label } from "@/lib/employees";
import { currentSalary, type Salary } from "@/lib/salary";

type Row = {
  id: string;
  employee_no: string;
  full_name: string;
  employment_type: string;
  status: string;
  departments: { name: string } | null;
  employee_salaries: Salary[];
};

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me || !canViewSalaries(me.role)) notFound();

  const { q, dept } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("employees")
    .select(
      "id, employee_no, full_name, employment_type, status, departments(name), employee_salaries(monthly_rate, hourly_rate, effective_from)"
    )
    .order("full_name");
  const term = q?.replace(/[,()%*]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,employee_no.ilike.%${term}%`);
  if (dept) query = query.eq("department_id", dept);

  const [{ data }, { data: departments }] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const today = manilaToday();

  const withCurrent = rows.map((r) => ({ ...r, current: currentSalary(r.employee_salaries, today) }));
  const active = withCurrent.filter((r) => r.status === "ACTIVE");
  const monthlyTotal = active.reduce((sum, r) => sum + Number(r.current?.monthly_rate ?? 0), 0);
  const missing = active.filter((r) => !r.current).length;

  const field =
    "rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Salaries</h1>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Monthly payroll (active, fixed rates)</p>
          <p className="mt-1 text-xl font-semibold">{formatPeso(monthlyTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Active employees</p>
          <p className="mt-1 text-xl font-semibold">{active.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Active with no salary set</p>
          <p className={`mt-1 text-xl font-semibold ${missing ? "text-warning" : ""}`}>{missing}</p>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or no." className={`${field} w-56`} />
        <select name="dept" defaultValue={dept ?? ""} className={field}>
          <option value="">All departments</option>
          {(departments ?? []).map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </select>
        <button className="rounded-lg bg-surface-raised px-3 py-1.5 text-sm hover:bg-border">Filter</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Monthly</th>
              <th className="px-4 py-3 text-right font-medium">Hourly</th>
              <th className="px-4 py-3 font-medium">Since</th>
            </tr>
          </thead>
          <tbody>
            {withCurrent.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <Link href={`/salaries/${r.id}`} className="text-accent hover:underline">{r.full_name}</Link>
                  <span className="ml-2 text-xs text-muted">{r.employee_no}</span>
                </td>
                <td className="px-4 py-3">{r.departments?.name ?? "—"}</td>
                <td className="px-4 py-3">{label(r.employment_type)}</td>
                <td className="px-4 py-3 text-right">{formatPeso(r.current?.monthly_rate)}</td>
                <td className="px-4 py-3 text-right">{formatPeso(r.current?.hourly_rate)}</td>
                <td className="px-4 py-3">{r.current?.effective_from ?? <span className="text-warning">Not set</span>}</td>
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
