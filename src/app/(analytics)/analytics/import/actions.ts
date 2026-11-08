"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditableWorkspace } from "@/lib/analytics/workspace";
import {
  CHANNEL_LABELS,
  foreignCurrencies,
  parseExport,
  type Channel,
  type ColumnMapping,
} from "@/lib/analytics/importers";
import { round2 } from "@/lib/analytics/values";
import { refreshUnitStartDates } from "@/lib/analytics/units";
import type { Database } from "@/lib/database.types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const CHUNK = 500;

export interface ImportResult {
  error: string | null;
  done?: boolean;
  channel?: string;
  inserted?: number;
  updated?: number;
  duplicates?: number;
  skipped?: number;
  newListings?: number;
  unmappedListings?: number;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function importExport(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  let ws;
  try {
    ws = await requireEditableWorkspace();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 8 MB. Export a shorter date range and upload it in parts." };

  const channelRaw = String(formData.get("channel") ?? "");
  const channel = (["airbnb", "booking", "agoda", "other"] as const).includes(channelRaw as Channel)
    ? (channelRaw as Channel)
    : undefined;
  let mapping: ColumnMapping | undefined;
  let fx: Record<string, number> = {};
  try {
    mapping = JSON.parse(String(formData.get("mapping") || "{}"));
    fx = JSON.parse(String(formData.get("fx") || "{}"));
  } catch {
    return { error: "The upload form sent invalid data. Refresh the page and try again." };
  }
  const defaultListing = String(formData.get("defaultListing") ?? "").trim() || undefined;

  // Parse again on the server — never trust the browser's preview.
  const text = await file.text();
  const parsed = parseExport(text, {
    channel,
    mapping,
    defaultListing,
    defaultCurrency: ws.workspace.base_currency,
  });
  if (!parsed.ok || !parsed.channel) return { error: parsed.error ?? "Couldn't read that file." };

  const base = ws.workspace.base_currency;
  const rates: Record<string, number> = { [base]: 1 };
  for (const cur of foreignCurrencies(parsed, base)) {
    const rate = Number(fx[cur]);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { error: `Enter the exchange rate for ${cur} (how many ${base} per 1 ${cur}).` };
    }
    rates[cur] = rate;
  }

  const supabase = await createClient();
  const workspaceId = ws.workspace.id;

  const { data: imp, error: impError } = await supabase
    .from("an_imports")
    .insert({
      workspace_id: workspaceId,
      channel: parsed.channel,
      file_name: file.name.slice(0, 200),
      row_count: parsed.totalRows,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      fx_rates: rates,
      created_by: ws.userId,
    })
    .select("id")
    .single();
  if (impError || !imp) return { error: impError?.message ?? "Couldn't start the import." };

  try {
    // 1. Listings: create any new ones, then map name → id.
    const { data: before } = await supabase
      .from("an_listings")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("channel", parsed.channel);
    const beforeCount = before?.length ?? 0;

    if (parsed.listings.length) {
      for (const part of chunks(parsed.listings, 200)) {
        const { error } = await supabase.from("an_listings").upsert(
          part.map((name) => ({ workspace_id: workspaceId, channel: parsed.channel!, external_name: name })),
          { onConflict: "workspace_id,channel,external_name", ignoreDuplicates: true }
        );
        if (error) throw new Error(error.message);
      }
    }
    const { data: allListings, error: listErr } = await supabase
      .from("an_listings")
      .select("id, external_name, unit_id")
      .eq("workspace_id", workspaceId)
      .eq("channel", parsed.channel);
    if (listErr) throw new Error(listErr.message);
    const listingByName = new Map((allListings ?? []).map((l) => [l.external_name, l]));

    // 2. Which rows were already imported (overlapping exports)?
    const existing = new Set<string>();
    for (const part of chunks(parsed.rows.map((r) => r.dedupeKey), 200)) {
      const { data, error } = await supabase
        .from("an_transactions")
        .select("dedupe_key")
        .eq("workspace_id", workspaceId)
        .in("dedupe_key", part);
      if (error) throw new Error(error.message);
      for (const d of data ?? []) existing.add(d.dedupe_key);
    }

    type Insert = Database["public"]["Tables"]["an_transactions"]["Insert"];
    const toRow = (r: (typeof parsed.rows)[number]): Insert => {
      const rate = rates[r.currency] ?? 1;
      return {
        workspace_id: workspaceId,
        import_id: imp.id,
        listing_id: r.listing ? listingByName.get(r.listing)?.id ?? null : null,
        channel: r.channel,
        kind: r.kind,
        raw_type: r.rawType,
        txn_date: r.date,
        confirmation_code: r.code,
        guest_name: r.guest,
        check_in: r.checkIn,
        check_out: r.checkOut,
        nights: r.nights,
        currency: r.currency,
        amount: r.amount,
        fx_rate: rate,
        amount_base: round2(r.amount * rate),
        gross: r.gross,
        service_fee: r.serviceFee,
        cleaning_fee: r.cleaningFee,
        taxes: r.taxes,
        paid_out: r.paidOut,
        details: r.details,
        dedupe_key: r.dedupeKey,
      };
    };

    // Airbnb rows are an immutable ledger: skip ones we already have.
    // Booking.com / Agoda rows are reservations: a newer export updates
    // the price/status of the same booking.
    const isLedger = parsed.channel === "airbnb";
    const fresh = parsed.rows.filter((r) => !existing.has(r.dedupeKey));
    const repeat = parsed.rows.filter((r) => existing.has(r.dedupeKey));

    for (const part of chunks(fresh.map(toRow), CHUNK)) {
      const { error } = await supabase
        .from("an_transactions")
        .upsert(part, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    let updated = 0;
    if (!isLedger && repeat.length) {
      for (const part of chunks(repeat.map(toRow), CHUNK)) {
        const { error } = await supabase.from("an_transactions").upsert(part, { onConflict: "workspace_id,dedupe_key" });
        if (error) throw new Error(error.message);
      }
      updated = repeat.length;
    }

    const skipped = parsed.skipped.reduce((s, x) => s + x.count, 0);
    await supabase
      .from("an_imports")
      .update({
        inserted_count: fresh.length,
        duplicate_count: isLedger ? repeat.length : 0,
        skipped_count: skipped,
      })
      .eq("id", imp.id);

    // 3. Units start operating no later than their earliest known stay.
    await refreshUnitStartDates(supabase, workspaceId);

    const after = allListings?.length ?? 0;
    revalidatePath("/analytics", "layout");
    return {
      error: null,
      done: true,
      channel: CHANNEL_LABELS[parsed.channel],
      inserted: fresh.length,
      updated,
      duplicates: isLedger ? repeat.length : 0,
      skipped,
      newListings: Math.max(0, after - beforeCount),
      unmappedListings: (allListings ?? []).filter((l) => !l.unit_id).length,
    };
  } catch (e) {
    // Don't leave a half-finished import behind.
    await supabase.from("an_imports").delete().eq("id", imp.id);
    return { error: `Import failed: ${(e as Error).message}` };
  }
}

export async function deleteImport(importId: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("an_imports").delete().eq("id", importId).eq("workspace_id", ws.workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics", "layout");
}
