import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { loadPortfolio } from "@/lib/analytics/data";
import { labelMonth, ownerStatement, shiftMonth } from "@/lib/analytics/metrics";
import { brandName, logoUrl } from "@/lib/analytics/branding";
import { getManilaToday } from "@/lib/calendar";
import { formatMoney, formatPercent, formatManilaDate } from "@/lib/format";
import { PrintButton } from "@/app/(dashboard)/bookings/[id]/receipt/PrintButton";
import { MonthPicker } from "./MonthPicker";

/**
 * Owner statement, branded with the manager's logo and colour. Rendered as
 * a light "paper" page so Print → Save as PDF looks like a document.
 */
export default async function OwnerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ws = await requireWorkspace();
  const thisMonth = getManilaToday().slice(0, 7);
  const raw = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) && raw <= thisMonth ? raw : shiftMonth(thisMonth, -1);

  const { portfolio: p, owners } = await loadPortfolio(ws.workspace.id, { from: month, to: month });
  const owner = owners.find((o) => o.id === id);
  if (!owner) notFound();

  const st = ownerStatement(p, owner.id, month, Number(owner.management_fee_pct));
  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);
  const brand = brandName(ws.workspace);
  const logo = logoUrl(ws.workspace.brand_logo_path);
  const accent = ws.workspace.brand_color ?? "#1d4ed8";
  const categories = Object.entries(st.totals.expensesByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/analytics/owners" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Owners
        </Link>
        <div className="flex items-center gap-2">
          <MonthPicker value={month} max={thisMonth} />
          <PrintButton />
        </div>
      </div>
      <p className="mb-4 text-xs text-muted print:hidden">
        Use Print → “Save as PDF” to send this to {owner.name}. {month === thisMonth && "This month isn't over yet, so figures are still changing."}
      </p>

      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-[13px] text-slate-800 shadow-lg print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-4 pb-5" style={{ borderColor: accent }}>
          <div className="flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={brand} className="h-12 max-w-[160px] object-contain" />
            )}
            <div>
              <div className="text-lg font-bold text-slate-900">{brand}</div>
              <div className="text-xs text-slate-500">Owner statement</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-slate-900">{labelMonth(month)}</div>
            <div className="text-xs text-slate-500">Prepared for {owner.name}</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-3 gap-4">
          {[
            ["Net earnings", st.totals.netEarnings],
            ["Expenses & fees", st.totals.expenses + st.totals.managementFee],
            ["Due to you", st.totals.dueToOwner],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className={`mt-1 text-lg font-semibold tabular-nums ${(value as number) < 0 ? "text-red-700" : "text-slate-900"}`}>
                {money(value as number)}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">By unit</h2>
          {st.lines.length === 0 ? (
            <p className="text-slate-500">No units are assigned to this owner.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 font-medium">Unit</th>
                  <th className="py-2 text-right font-medium">Nights</th>
                  <th className="py-2 text-right font-medium">Occupancy</th>
                  <th className="py-2 text-right font-medium">Earnings</th>
                  <th className="py-2 text-right font-medium">Expenses</th>
                  <th className="py-2 text-right font-medium">Mgmt fee</th>
                  <th className="py-2 text-right font-medium">Due to you</th>
                </tr>
              </thead>
              <tbody>
                {st.lines.map((l) => (
                  <tr key={l.unit.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <div className="font-medium text-slate-900">{l.unit.name}</div>
                      {l.unit.building && <div className="text-[11px] text-slate-500">{l.unit.building}</div>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{l.nights}</td>
                    <td className="py-2 text-right tabular-nums">{formatPercent(l.occupancy)}</td>
                    <td className="py-2 text-right tabular-nums">{money(l.netEarnings)}</td>
                    <td className="py-2 text-right tabular-nums">{money(-l.expenses)}</td>
                    <td className="py-2 text-right tabular-nums">{money(-l.managementFee)}</td>
                    <td className={`py-2 text-right font-medium tabular-nums ${l.dueToOwner < 0 ? "text-red-700" : "text-slate-900"}`}>
                      {money(l.dueToOwner)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-slate-900">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right tabular-nums">{st.totals.nights}</td>
                  <td />
                  <td className="py-2 text-right tabular-nums">{money(st.totals.netEarnings)}</td>
                  <td className="py-2 text-right tabular-nums">{money(-st.totals.expenses)}</td>
                  <td className="py-2 text-right tabular-nums">{money(-st.totals.managementFee)}</td>
                  <td className="py-2 text-right tabular-nums">{money(st.totals.dueToOwner)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {categories.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Expenses</h2>
            <table className="w-full max-w-sm">
              <tbody>
                {categories.map(([cat, v]) => (
                  <tr key={cat} className="border-b border-slate-100">
                    <td className="py-1.5">{cat}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
          <p>
            Earnings are what the booking channels paid out for stays in {labelMonth(month)}, after channel fees, co-host
            shares, refunds and adjustments; stays crossing month-end are split by night. The management fee is{" "}
            {Number(owner.management_fee_pct)}% of each unit&apos;s net earnings for the month.
          </p>
          {ws.workspace.statement_footer && <p className="mt-2 whitespace-pre-line">{ws.workspace.statement_footer}</p>}
          <p className="mt-2">Generated {formatManilaDate(getManilaToday())} · {brand}</p>
        </footer>
      </article>
    </div>
  );
}
