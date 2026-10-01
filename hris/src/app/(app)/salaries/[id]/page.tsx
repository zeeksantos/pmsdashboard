import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewSalaries } from "@/lib/roles";
import { formatPeso, manilaToday } from "@/lib/format";
import { label } from "@/lib/employees";
import { SalaryForm } from "./SalaryForm";
import { DeleteButton } from "./DeleteButton";

export default async function EmployeeSalaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canViewSalaries(me.role)) notFound();

  const supabase = await createClient();
  const [{ data: emp }, { data: history }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_no, full_name, employment_type, positions(title), departments(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("employee_salaries")
      .select("id, monthly_rate, hourly_rate, effective_from")
      .eq("employee_id", id)
      .order("effective_from", { ascending: false }),
  ]);
  if (!emp) notFound();

  const e = emp as unknown as {
    employee_no: string;
    full_name: string;
    employment_type: string;
    positions: { title: string } | null;
    departments: { name: string } | null;
  };
  const today = manilaToday();
  const rows = history ?? [];
  const currentId = rows.find((r) => r.effective_from <= today)?.id;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/salaries" className="text-sm text-muted hover:text-foreground">← All salaries</Link>
        <h1 className="mt-2 text-2xl font-semibold">{e.full_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {e.employee_no} · {e.positions?.title ?? "No position"} · {e.departments?.name ?? "No department"} ·{" "}
          {label(e.employment_type)}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 text-base font-semibold">Add a new salary</h2>
        <p className="mb-4 text-sm text-muted">
          A raise or change is a new entry with its own effective date. The past stays on record.
        </p>
        <SalaryForm employeeId={id} today={today} />
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">Salary history</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Effective from</th>
              <th className="px-5 py-3 text-right font-medium">Monthly</th>
              <th className="px-5 py-3 text-right font-medium">Hourly</th>
              <th className="px-5 py-3 font-medium"></th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">{r.effective_from}</td>
                <td className="px-5 py-3 text-right">{formatPeso(r.monthly_rate)}</td>
                <td className="px-5 py-3 text-right">{formatPeso(r.hourly_rate)}</td>
                <td className="px-5 py-3 text-xs">
                  {r.id === currentId && <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">Current</span>}
                  {r.effective_from > today && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Scheduled</span>}
                </td>
                <td className="px-5 py-3 text-right"><DeleteButton id={r.id} employeeId={id} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-muted">No salary set yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
