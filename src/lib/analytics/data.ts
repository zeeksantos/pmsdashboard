// Server-side loaders for analytics pages. Every number is built from the
// same an_transactions rows the All transactions tab lists — there is no
// separate summary table to drift out of sync.

import { createClient } from "@/lib/supabase/server";
import { getManilaToday, toManilaDateString } from "@/lib/calendar";
import { formatMoney } from "@/lib/format";
import type { AnExpense, AnListing, AnOwner, AnUnit } from "@/lib/database.types";
import {
  buildPortfolio,
  monthEnd,
  monthRange,
  shiftMonth,
  type FixedCostInput,
  type MonthlyCostInput,
  type Portfolio,
  type TxnInput,
} from "./metrics";
import { buildUpcoming, type Upcoming, type UpcomingTxn } from "./upcoming";
import { buildReport, type Report, type ReportTxn } from "./report";

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

interface Base {
  units: AnUnit[];
  listings: AnListing[];
  owners: AnOwner[];
  fixedCosts: FixedCostInput[];
  monthlyCosts: MonthlyCostInput[];
  expenses: AnExpense[];
  lastImportAt: string | null;
}

async function loadBase(db: Client, workspaceId: string, period: Pick<Period, "from" | "to">): Promise<Base> {
  const rangeStart = `${period.from}-01`;
  const rangeEnd = monthEnd(period.to);
  const [units, listings, owners, fixed, monthly, expenses, lastImport] = await Promise.all([
    fetchAll<AnUnit>((a, b) => db.from("an_units").select("*").eq("workspace_id", workspaceId).order("name").range(a, b)),
    fetchAll<AnListing>((a, b) =>
      db.from("an_listings").select("*").eq("workspace_id", workspaceId).order("external_name").range(a, b)
    ),
    fetchAll<AnOwner>((a, b) => db.from("an_owners").select("*").eq("workspace_id", workspaceId).order("name").range(a, b)),
    fetchAll((a, b) =>
      db
        .from("an_unit_costs")
        .select("unit_id, rent, other_fixed, electricity, water, cleaning_per_stay")
        .eq("workspace_id", workspaceId)
        .range(a, b)
    ),
    fetchAll((a, b) =>
      db
        .from("an_monthly_costs")
        .select("unit_id, month, cleaning, other")
        .eq("workspace_id", workspaceId)
        .gte("month", rangeStart)
        .lte("month", rangeEnd)
        .range(a, b)
    ),
    fetchAll<AnExpense>((a, b) =>
      db
        .from("an_expenses")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("spent_on", rangeStart)
        .lte("spent_on", rangeEnd)
        .range(a, b)
    ),
    db.from("an_imports").select("created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1),
  ]);
  const num = (v: unknown) => Number(v ?? 0);
  return {
    units,
    listings,
    owners,
    fixedCosts: fixed.map((c) => ({
      unit_id: c.unit_id,
      rent: num(c.rent),
      other_fixed: num(c.other_fixed),
      electricity: num(c.electricity),
      water: num(c.water),
      cleaning_per_stay: num(c.cleaning_per_stay),
    })),
    monthlyCosts: monthly.map((m) => ({ unit_id: m.unit_id, month: m.month, cleaning: num(m.cleaning), other: num(m.other) })),
    expenses: expenses.map((e) => ({ ...e, amount: num(e.amount) })),
    lastImportAt: lastImport.data?.[0]?.created_at ?? null,
  };
}

/** Transactions whose date or stay touches the period. */
function periodTxnFilter(period: Pick<Period, "from" | "to">) {
  const rangeStart = `${period.from}-01`;
  const rangeEnd = monthEnd(period.to);
  return {
    afterStart: `check_out.gt.${rangeStart},txn_date.gte.${rangeStart}`,
    beforeEnd: `check_in.lte.${rangeEnd},txn_date.lte.${rangeEnd}`,
  };
}

export interface PortfolioData extends Base {
  portfolio: Portfolio;
}

export async function loadPortfolio(workspaceId: string, period: Pick<Period, "from" | "to">, supabase?: Client): Promise<PortfolioData> {
  const db = supabase ?? (await createClient());
  const f = periodTxnFilter(period);
  const [b, transactions] = await Promise.all([
    loadBase(db, workspaceId, period),
    fetchAll<TxnInput>((a, z) =>
      db
        .from("an_transactions")
        .select("id, kind, channel, txn_date, check_in, check_out, amount_base, listing_id, confirmation_code")
        .eq("workspace_id", workspaceId)
        .eq("pending", false)
        .or(f.afterStart)
        .or(f.beforeEnd)
        .order("id")
        .range(a, z)
    ),
  ]);
  const portfolio = buildPortfolio(
    {
      transactions: transactions.map((t) => ({ ...t, amount_base: Number(t.amount_base) })),
      units: b.units,
      listings: b.listings,
      fixedCosts: b.fixedCosts,
      monthlyCosts: b.monthlyCosts,
      expenses: b.expenses,
    },
    period
  );
  return { ...b, portfolio };
}

export interface ReportData extends Base {
  report: Report;
}

export async function loadReport(workspaceId: string, period: Pick<Period, "from" | "to">, currency: string): Promise<ReportData> {
  const db = await createClient();
  const f = periodTxnFilter(period);
  const [b, transactions] = await Promise.all([
    loadBase(db, workspaceId, period),
    fetchAll<ReportTxn>((a, z) =>
      db
        .from("an_transactions")
        .select(
          "id, kind, raw_type, channel, txn_date, booked_on, confirmation_code, guest_name, check_in, check_out, nights, currency, amount, fx_rate, amount_base, gross, service_fee, cleaning_fee, paid_out, details, listing_id"
        )
        .eq("workspace_id", workspaceId)
        .eq("pending", false)
        .or(f.afterStart)
        .or(f.beforeEnd)
        .order("id")
        .range(a, z)
    ),
  ]);
  const num = (v: unknown) => (v == null ? null : Number(v));
  const report = buildReport({
    transactions: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      fx_rate: Number(t.fx_rate),
      amount_base: Number(t.amount_base),
      gross: num(t.gross),
      service_fee: num(t.service_fee),
      cleaning_fee: num(t.cleaning_fee),
      paid_out: num(t.paid_out),
    })),
    units: b.units,
    listings: b.listings,
    fixedCosts: b.fixedCosts,
    monthlyCosts: b.monthlyCosts,
    expenses: b.expenses,
    from: period.from,
    to: period.to,
    today: getManilaToday(),
    lastImportAt: b.lastImportAt ? toManilaDateString(b.lastImportAt) : null,
    formatMoney: (n) => formatMoney(n, currency),
  });
  return { ...b, report };
}

export { monthRange };

/** Upcoming (pending, not yet paid) bookings — never part of earnings. */
export async function loadUpcoming(workspaceId: string, units: AnUnit[], listings: AnListing[]): Promise<Upcoming> {
  const db = await createClient();
  const transactions = await fetchAll<UpcomingTxn>((a, z) =>
    db
      .from("an_transactions")
      .select("id, kind, txn_date, confirmation_code, guest_name, check_in, check_out, nights, booked_on, amount_base, gross, cleaning_fee, fx_rate, listing_id")
      .eq("workspace_id", workspaceId)
      .eq("pending", true)
      .order("id")
      .range(a, z)
  );
  return buildUpcoming({
    transactions: transactions.map((t) => ({
      ...t,
      amount_base: Number(t.amount_base),
      fx_rate: Number(t.fx_rate),
      gross: t.gross == null ? null : Number(t.gross),
      cleaning_fee: t.cleaning_fee == null ? null : Number(t.cleaning_fee),
    })),
    units,
    listings,
    today: getManilaToday(),
  });
}
