import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { CHANNEL_LABELS, KIND_LABELS } from "@/lib/analytics/importers";
import { formatMoney } from "@/lib/format";
import type { AnChannel, AnTxnKind } from "@/lib/database.types";
import { PageHeader, EmptyState } from "@/components/analytics/PageHeader";
import { inputClass, secondaryButton } from "@/components/analytics/ui";

const PAGE_SIZE = 100;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const q = one("q").trim();
  const kind = one("kind") as AnTxnKind | "";
  const channel = one("channel") as AnChannel | "";
  const unit = one("unit");
  const page = Math.max(0, Number(one("page")) || 0);

  const supabase = await createClient();
  const [{ data: units }, { data: listings }] = await Promise.all([
    supabase.from("an_units").select("id, name").eq("workspace_id", ws.workspace.id).order("name"),
    supabase.from("an_listings").select("id, external_name, unit_id").eq("workspace_id", ws.workspace.id),
  ]);
  const listingById = new Map((listings ?? []).map((l) => [l.id, l]));
  const unitName = new Map((units ?? []).map((u) => [u.id, u.name]));

  let query = supabase
    .from("an_transactions")
    .select("*", { count: "exact" })
    .eq("workspace_id", ws.workspace.id)
    .order("txn_date", { ascending: false })
    .order("id")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (kind) query = query.eq("kind", kind);
  if (channel) query = query.eq("channel", channel);
  if (unit) {
    const ids = (listings ?? []).filter((l) => (unit === "none" ? !l.unit_id : l.unit_id === unit)).map((l) => l.id);
    query = ids.length ? query.in("listing_id", ids) : query.eq("listing_id", "00000000-0000-0000-0000-000000000000");
  }
  if (q) {
    const safe = q.replace(/[%,()*]/g, " ").slice(0, 60);
    query = query.or(`guest_name.ilike.%${safe}%,confirmation_code.ilike.%${safe}%,details.ilike.%${safe}%`);
  }
  const { data: rows, count, error } = await query;
  const money = (n: number) => formatMoney(n, ws.workspace.base_currency);
  const total = count ?? 0;
  const pageLink = (n: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, kind, channel, unit })) if (v) params.set(k, v);
    if (n) params.set("page", String(n));
    return `?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Every row imported from your exports. All dashboard numbers are calculated from these."
      />

      <form className="grid gap-2 sm:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Guest or confirmation code" className={`${inputClass} sm:col-span-2`} />
        <select name="kind" defaultValue={kind} className={inputClass} aria-label="Type">
          <option value="">All types</option>
          {(Object.keys(KIND_LABELS) as AnTxnKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select name="channel" defaultValue={channel} className={inputClass} aria-label="Channel">
          <option value="">All channels</option>
          {(Object.keys(CHANNEL_LABELS) as AnChannel[]).map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
        <select name="unit" defaultValue={unit} className={inputClass} aria-label="Unit">
          <option value="">All units</option>
          <option value="none">Not linked to a unit</option>
          {(units ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-5">
          <button type="submit" className={secondaryButton}>
            Filter
          </button>
          {(q || kind || channel || unit) && (
            <Link href="/analytics/transactions" className={secondaryButton}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-danger">{error.message}</p>}
      {!error && total === 0 ? (
        <EmptyState>No transactions match.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Guest / details</th>
                <th className="px-3 py-2.5 font-medium">Stay</th>
                <th className="px-3 py-2.5 font-medium">Unit · listing</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const listing = r.listing_id ? listingById.get(r.listing_id) : null;
                const base = Number(r.amount_base);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{r.txn_date}</td>
                    <td className="px-3 py-2">
                      <div className="text-foreground">{KIND_LABELS[r.kind]}</div>
                      <div className="text-xs text-muted">{CHANNEL_LABELS[r.channel]}</div>
                    </td>
                    <td className="max-w-[240px] px-3 py-2">
                      <div className="truncate text-foreground">{r.guest_name ?? r.details ?? "—"}</div>
                      {r.confirmation_code && <div className="text-xs text-muted">{r.confirmation_code}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {r.check_in ? `${r.check_in} → ${r.check_out}` : "—"}
                      {r.nights ? ` · ${r.nights}n` : ""}
                    </td>
                    <td className="max-w-[240px] px-3 py-2">
                      <div className="truncate text-foreground">
                        {listing?.unit_id ? unitName.get(listing.unit_id) : <span className="text-warning">{listing ? "Not linked" : "—"}</span>}
                      </div>
                      <div className="truncate text-xs text-muted">{listing?.external_name}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {r.kind === "payout" ? (
                        <span className="text-muted">
                          {r.paid_out != null ? `${r.currency} ${Number(r.paid_out).toLocaleString()} paid out` : "Payout"}
                        </span>
                      ) : (
                        <>
                          <div className={base < 0 ? "text-danger" : "text-foreground"}>{money(base)}</div>
                          {r.currency !== ws.workspace.base_currency && (
                            <div className="text-xs text-muted">
                              {r.currency} {Number(r.amount).toLocaleString()} @ {Number(r.fx_rate)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total.toLocaleString()}
          </span>
          <span className="flex gap-2">
            {page > 0 && (
              <Link href={pageLink(page - 1)} className={secondaryButton}>
                Previous
              </Link>
            )}
            {(page + 1) * PAGE_SIZE < total && (
              <Link href={pageLink(page + 1)} className={secondaryButton}>
                Next
              </Link>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
