import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";
import { manilaToday } from "@/lib/format";
import { TypeForm } from "./TypeForm";
import { AllocationForm } from "./AllocationForm";

export default async function LeaveSettingsPage() {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) notFound();

  const supabase = await createClient();
  const year = Number(manilaToday().slice(0, 4));
  const [{ data: types }, { data: employees }, { data: overrides }] = await Promise.all([
    supabase.from("leave_types").select("id, name, default_days, has_balance, is_paid, active").order("name"),
    supabase.from("employees").select("id, full_name").eq("status", "ACTIVE").order("full_name"),
    supabase
      .from("leave_allocations")
      .select("id, days, year, employees(full_name), leave_types(name)")
      .eq("year", year),
  ]);
  const over = (overrides ?? []) as unknown as {
    id: string; days: number; employees: { full_name: string } | null; leave_types: { name: string } | null;
  }[];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/leave" className="text-sm text-muted hover:text-foreground">← Leave</Link>
        <h1 className="mt-2 text-2xl font-semibold">Leave settings</h1>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Leave types</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Days are per employee per calendar year and don&apos;t carry over. <b>Capped</b> types can&apos;t be
          requested beyond the balance; uncapped ones (like unpaid leave) can. The starting values are
          placeholders. Set them to your company policy. Untick <b>Active</b> to retire a type without
          losing history.
        </p>
        <div className="flex flex-col gap-3">
          {(types ?? []).map((t) => (<TypeForm key={t.id} type={{ ...t, default_days: Number(t.default_days) }} />))}
          <div className="border-t border-border pt-3"><TypeForm /></div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Adjust one employee&apos;s allowance</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Overrides the default for a single employee and year (for example a tenure bonus). Leave the
          days blank to remove the override.
        </p>
        <AllocationForm employees={employees ?? []} types={types ?? []} year={year} />
        {over.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {over.map((o) => (
              <li key={o.id} className="text-muted">
                {o.employees?.full_name} · {o.leave_types?.name}: <span className="text-foreground">{Number(o.days)} days</span> in {year}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
