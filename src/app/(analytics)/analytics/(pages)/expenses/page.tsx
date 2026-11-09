import Link from "next/link";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { fetchAll, loadPortfolio, periodOptions, resolvePeriod } from "@/lib/analytics/data";
import { monthEnd } from "@/lib/analytics/metrics";
import { getManilaToday } from "@/lib/calendar";
import { formatMoney, formatManilaDate } from "@/lib/format";
import type { AnExpense } from "@/lib/database.types";
import { PageHeader, Card } from "@/components/analytics/PageHeader";
import { PeriodPicker } from "@/components/analytics/PeriodPicker";
import { BarList } from "@/components/analytics/BarList";
import { ConfirmButton } from "@/components/analytics/ConfirmButton";
import { Kpi, KpiGrid } from "@/components/analytics/Kpi";
import { ExpenseForm } from "./ExpenseForm";
import { deleteExpense } from "./actions";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ws = await requireWorkspace();
  const period = resolvePeriod((await searchParams).period);
  const supabase = await createClient();
  const [{ portfolio: p, units }, expenses] = await Promise.all([
    loadPortfolio(ws.workspace.id, period, supabase),
    fetchAll<AnExpense>((a, b) =>
      supabase
        .from("an_expenses")
        .select("*")
        .eq("workspace_id", ws.workspace.id)
        .gte("spent_on", `${period.from}-01`)
        .lte("spent_on", monthEnd(period.to))
        .order("spent_on", { ascending: false })
        .range(a, b)
    ),
  ]);
  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);
  const unitName = new Map(units.map((u) => [u.id, u.name]));

  const byCategory: Record<string, number> = {};
  for (const mo of p.months) {
    for (const [k, v] of Object.entries(p.total[mo].expensesByCategory)) byCategory[k] = (byCategory[k] ?? 0) + v;
  }
  const categoryRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
  const oneOffTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const fixedTotal = p.totals.expenses - oneOffTotal;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description={
          <>
            One-off costs with receipts go here. Fixed monthly costs (rent, utilities averages, dues) are set once on each{" "}
            <Link href="/analytics/units" className="text-accent hover:underline">
              unit&apos;s page
            </Link>
            .
          </>
        }
        actions={<PeriodPicker value={period.key} options={periodOptions()} />}
      />

      <KpiGrid>
        <Kpi label="Total expenses" value={money(p.totals.expenses)} sub={period.label} />
        <Kpi label="Fixed monthly costs" value={money(fixedTotal)} sub="From unit pages" />
        <Kpi label="One-off expenses" value={money(oneOffTotal)} sub={`${expenses.length} entries`} />
        <Kpi
          label="Expense ratio"
          value={p.totals.netEarnings > 0 ? `${Math.round((p.totals.expenses / p.totals.netEarnings) * 100)}%` : "—"}
          sub="Of net earnings"
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-5">
        {ws.canEdit && (
          <Card title="Add an expense" className="lg:col-span-2">
            <ExpenseForm
              units={units.filter((u) => !u.archived).map((u) => ({ id: u.id, name: u.building ? `${u.name} · ${u.building}` : u.name }))}
              today={getManilaToday()}
            />
          </Card>
        )}
        <Card title="Where the money goes" className={ws.canEdit ? "lg:col-span-3" : "lg:col-span-5"}>
          {categoryRows.length ? (
            <BarList rows={categoryRows} format={money} />
          ) : (
            <p className="text-sm text-muted">No expenses in this period yet.</p>
          )}
        </Card>
      </div>

      <Card title="One-off expenses">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded for {period.label.toLowerCase()}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="whitespace-nowrap py-2">{formatManilaDate(e.spent_on)}</td>
                    <td className="py-2">{e.unit_id ? unitName.get(e.unit_id) ?? "—" : <span className="text-muted">Portfolio</span>}</td>
                    <td className="py-2 text-muted">{e.category}</td>
                    <td className="py-2 text-muted">{e.description}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{money(Number(e.amount))}</td>
                    <td className="py-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        {e.receipt_path && (
                          <a
                            href={`/analytics/expenses/receipt/${e.id}`}
                            target="_blank"
                            rel="noopener"
                            className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
                            aria-label="Open receipt"
                            title="Open receipt"
                          >
                            <Paperclip className="h-4 w-4" />
                          </a>
                        )}
                        {ws.canEdit && (
                          <ConfirmButton
                            action={deleteExpense.bind(null, e.id)}
                            label="Delete expense"
                            confirmText={`Delete this ${money(Number(e.amount))} expense${e.receipt_path ? " and its receipt" : ""}?`}
                          />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
