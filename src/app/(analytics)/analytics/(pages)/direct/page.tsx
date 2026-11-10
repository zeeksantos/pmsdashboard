import Link from "next/link";
import { requireWorkspace } from "@/lib/analytics/workspace";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/analytics/data";
import { formatMoney } from "@/lib/format";
import { getManilaToday } from "@/lib/calendar";
import { sourceColor } from "@/lib/analytics/sources";
import { PageHeader, Card, EmptyState } from "@/components/analytics/PageHeader";
import { ConfirmButton } from "@/components/analytics/ConfirmButton";
import { DirectBookingDialog, type DirectBookingValues } from "./DirectBookingDialog";
import { deleteDirectBooking } from "./actions";

const fmt = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function DirectBookingsPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const workspaceId = ws.workspace.id;
  const currency = ws.workspace.base_currency;
  const money = (n: number) => formatMoney(n, currency);
  const today = getManilaToday();

  const [units, listings, raw] = await Promise.all([
    fetchAll<{ id: string; name: string; building: string | null; archived: boolean }>((a, b) =>
      supabase.from("an_units").select("id, name, building, archived").eq("workspace_id", workspaceId).order("name").range(a, b)
    ),
    fetchAll<{ id: string; unit_id: string | null }>((a, b) =>
      supabase.from("an_listings").select("id, unit_id").eq("workspace_id", workspaceId).eq("channel", "direct").range(a, b)
    ),
    fetchAll<{
      id: string;
      listing_id: string | null;
      source: string | null;
      guest_name: string | null;
      details: string | null;
      confirmation_code: string | null;
      check_in: string | null;
      check_out: string | null;
      nights: number | null;
      booked_on: string | null;
      gross: number | null;
      service_fee: number | null;
      amount_base: number;
      payment_method: string | null;
      notes: string | null;
    }>((a, b) =>
      supabase
        .from("an_transactions")
        .select("id, listing_id, source, guest_name, details, confirmation_code, check_in, check_out, nights, booked_on, gross, service_fee, amount_base, payment_method, notes")
        .eq("workspace_id", workspaceId)
        .eq("channel", "direct")
        .order("check_in", { ascending: false })
        .range(a, b)
    ),
  ]);

  type Row = (typeof raw)[number] & { check_in: string; check_out: string };
  const rows = raw.filter((r): r is Row => !!r.check_in && !!r.check_out);
  const unitOfListing = new Map(listings.map((l) => [l.id, l.unit_id]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const unitOptions = units.filter((u) => !u.archived).map((u) => ({ id: u.id, name: u.building ? `${u.name} · ${u.building}` : u.name }));

  const year = today.slice(0, 4);
  const thisYear = rows.filter((r) => r.check_in.startsWith(year) && r.check_in <= today);
  const bySource = new Map<string, { bookings: number; nights: number; net: number }>();
  for (const r of thisYear) {
    const k = r.source ?? "Other";
    const a = bySource.get(k) ?? { bookings: 0, nights: 0, net: 0 };
    a.bookings += 1;
    a.nights += r.nights ?? 0;
    a.net += Number(r.amount_base);
    bySource.set(k, a);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1].net - a[1].net);
  const upcoming = rows.filter((r) => r.check_in > today).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Direct bookings"
        description="Bookings you take yourself — through Facebook, Instagram, TikTok, Messenger, referrals or walk-ins. They count in every tab of the dashboard next to your Airbnb, Booking.com and Agoda bookings, and the Sources tab compares where your bookings come from."
        actions={ws.canEdit ? <DirectBookingDialog units={unitOptions} today={today} currency={currency} /> : null}
      />

      {units.length === 0 && (
        <EmptyState>
          Add a unit first on{" "}
          <Link href="/analytics/units" className="text-accent hover:underline">
            Unit setup
          </Link>
          , then record its direct bookings here.
        </EmptyState>
      )}

      {sources.length > 0 && (
        <Card title={`${year} so far, by source`} description="Stays that have already checked in. Future stays are on the dashboard's Upcoming tab.">
          <div className="flex flex-wrap gap-3">
            {sources.map(([label, a], i) => (
              <div key={label} className="min-w-[150px] rounded-lg border border-border px-3 py-2" style={{ borderLeft: `4px solid ${sourceColor(label, i)}` }}>
                <div className="text-xs text-muted">{label}</div>
                <div className="text-lg font-semibold text-foreground">{money(a.net)}</div>
                <div className="text-xs text-muted">
                  {a.bookings} booking{a.bookings === 1 ? "" : "s"} · {a.nights} nights
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        units.length > 0 && (
          <EmptyState>
            No direct bookings yet. Click <b>Add direct booking</b> each time a guest books through your page, chat or a referral — or upload a
            spreadsheet of them on{" "}
            <Link href="/analytics/import" className="text-accent hover:underline">
              Upload exports
            </Link>{" "}
            (choose &ldquo;Other / direct&rdquo; and match a &ldquo;Source&rdquo; column).
          </EmptyState>
        )
      ) : (
        <Card title={`All direct bookings (${rows.length})`} description={upcoming ? `${upcoming} still to come` : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Stay</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Guest</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Paid via</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th className="pb-2 text-right font-medium">Fees</th>
                  <th className="pb-2 text-right font-medium">You keep</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const unitId = r.listing_id ? unitOfListing.get(r.listing_id) ?? null : null;
                  const unit = unitId ? unitById.get(unitId) : undefined;
                  const values: DirectBookingValues = {
                    id: r.id,
                    unit_id: unitId,
                    source: r.source,
                    guest: r.guest_name,
                    contact: r.details,
                    reference: r.confirmation_code,
                    check_in: r.check_in,
                    check_out: r.check_out,
                    booked_on: r.booked_on,
                    total: Number(r.gross ?? r.amount_base),
                    fees: Number(r.service_fee ?? 0),
                    payment_method: r.payment_method,
                    notes: r.notes,
                  };
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {fmt(r.check_in)} – {fmt(r.check_out)}
                        <div className="text-xs text-muted">
                          {r.nights} night{r.nights === 1 ? "" : "s"}
                          {r.check_in > today && " · upcoming"}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{unit ? unit.name : <span className="text-muted">—</span>}</td>
                      <td className="py-2 pr-3">
                        {r.guest_name ?? <span className="text-muted">—</span>}
                        {r.details && <div className="text-xs text-muted">{r.details}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: sourceColor(r.source ?? "Other", i) }} />
                          {r.source ?? "Other"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-muted">{r.payment_method ?? "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{money(Number(r.gross ?? r.amount_base))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted">{r.service_fee ? money(-Number(r.service_fee)) : "—"}</td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">{money(Number(r.amount_base))}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {ws.canEdit && (
                          <>
                            <DirectBookingDialog booking={values} units={unitOptions} today={today} currency={currency} />
                            <ConfirmButton
                              action={deleteDirectBooking.bind(null, r.id)}
                              confirmText={`Delete ${r.guest_name ?? "this"} booking (${fmt(r.check_in)})? This can't be undone.`}
                              label="Delete booking"
                            />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
