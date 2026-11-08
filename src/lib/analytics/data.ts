// Server-side loaders for analytics pages. Every page builds its numbers
// from loadPortfolio(), i.e. the same an_transactions rows the Transactions
// page lists — there is no separate summary table to drift out of sync.

import { createClient } from "@/lib/supabase/server";
import { getManilaToday } from "@/lib/calendar";
import type { AnListing, AnOwner, AnUnit } from "@/lib/database.types";
import { buildPortfolio, monthEnd, monthRange, shiftMonth, type Portfolio, type TxnInput } from "./metrics";

type Client = Awaited<ReturnType<typeof createClient>>;

/** PostgREST caps a response at 1,000 rows; page through to get them all. */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export interface Period {
  key: string; // "2026" or "12m"
  label: string;
  from: string; // YYYY-MM
  to: string; // YYYY-MM
}

/** `?period=2026` → that calendar year (up to this month); `12m` → last 12 months. */
export function resolvePeriod(raw: string | string[] | undefined, today = getManilaToday()): Period {
  const thisMonth = today.slice(0, 7);
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "12m") {
    return { key: "12m", label: "Last 12 months", from: shiftMonth(thisMonth, -11), to: thisMonth };
  }
  const year = value && /^\d{4}$/.test(value) ? Number(value) : Number(today.slice(0, 4));
  const to = `${year}-12` > thisMonth ? thisMonth : `${year}-12`;
  const from = `${year}-01`;
  return { key: String(year), label: String(year), from, to: to < from ? from : to };
}

export function periodOptions(today = getManilaToday()): { key: string; label: string }[] {
  const year = Number(today.slice(0, 4));
  return [
    { key: "12m", label: "Last 12 months" },
    { key: String(year), label: String(year) },
    { key: String(year - 1), label: String(year - 1) },
    { key: String(year - 2), label: String(year - 2) },
  ];
}

export interface PortfolioData {
  portfolio: Portfolio;
  units: AnUnit[];
  listings: AnListing[];
  owners: AnOwner[];
  lastImportAt: string | null;
}

export async function loadPortfolio(workspaceId: string, period: Pick<Period, "from" | "to">, supabase?: Client): Promise<PortfolioData> {
  const db = supabase ?? (await createClient());
  const rangeStart = `${period.from}-01`;
  const rangeEnd = monthEnd(period.to);

  const [units, listings, owners, recurring, expenses, lastImport, transactions] = await Promise.all([
    fetchAll<AnUnit>((a, b) => db.from("an_units").select("*").eq("workspace_id", workspaceId).order("name").range(a, b)),
    fetchAll<AnListing>((a, b) => db.from("an_listings").select("*").eq("workspace_id", workspaceId).order("external_name").range(a, b)),
    fetchAll<AnOwner>((a, b) => db.from("an_owners").select("*").eq("workspace_id", workspaceId).order("name").range(a, b)),
    fetchAll((a, b) =>
      db
        .from("an_recurring_costs")
        .select("unit_id, category, monthly_amount, starts_on, ends_on")
        .eq("workspace_id", workspaceId)
        .lte("starts_on", rangeEnd)
        .or(`ends_on.is.null,ends_on.gte.${rangeStart}`)
        .range(a, b)
    ),
    fetchAll((a, b) =>
      db
        .from("an_expenses")
        .select("unit_id, category, amount, spent_on")
        .eq("workspace_id", workspaceId)
        .gte("spent_on", rangeStart)
        .lte("spent_on", rangeEnd)
        .range(a, b)
    ),
    db.from("an_imports").select("created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1),
    // Rows whose stay or date touches the period (stays crossing the edges
    // are included and split by metrics).
    fetchAll<TxnInput>((a, b) =>
      db
        .from("an_transactions")
        .select("id, kind, channel, txn_date, check_in, check_out, amount_base, listing_id, confirmation_code")
        .eq("workspace_id", workspaceId)
        .or(`check_out.gt.${rangeStart},and(check_out.is.null,txn_date.gte.${rangeStart})`)
        .or(`check_in.lte.${rangeEnd},and(check_in.is.null,txn_date.lte.${rangeEnd})`)
        .order("id")
        .range(a, b)
    ),
  ]);

  const portfolio = buildPortfolio(
    {
      transactions: transactions.map((t) => ({ ...t, amount_base: Number(t.amount_base) })),
      units,
      listings,
      recurringCosts: recurring.map((r) => ({ ...r, monthly_amount: Number(r.monthly_amount) })),
      expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    },
    period
  );

  const lastImportAt = lastImport.data?.[0]?.created_at ?? null;
  return { portfolio, units, listings, owners, lastImportAt };
}

export { monthRange };
