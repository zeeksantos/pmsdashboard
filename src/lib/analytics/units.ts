import type { createClient } from "@/lib/supabase/server";

/**
 * Sets each unit's active_from to its earliest stay when that's earlier
 * than what's stored (or nothing is stored), so occupancy is measured from
 * when the unit actually started operating.
 */
export async function refreshUnitStartDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  onlyUnitIds?: string[]
) {
  let unitQuery = supabase.from("an_units").select("id, active_from").eq("workspace_id", workspaceId);
  if (onlyUnitIds) unitQuery = unitQuery.in("id", onlyUnitIds);
  const { data: units } = await unitQuery;
  if (!units?.length) return;

  const { data: listings } = await supabase
    .from("an_listings")
    .select("id, unit_id")
    .eq("workspace_id", workspaceId)
    .not("unit_id", "is", null);
  for (const u of units) {
    const ids = (listings ?? []).filter((l) => l.unit_id === u.id).map((l) => l.id);
    if (!ids.length) continue;
    const { data: first } = await supabase
      .from("an_transactions")
      .select("check_in")
      .eq("workspace_id", workspaceId)
      .in("listing_id", ids)
      .in("kind", ["booking", "cohost"])
      .not("check_in", "is", null)
      .order("check_in", { ascending: true })
      .limit(1);
    const earliest = first?.[0]?.check_in;
    if (earliest && (!u.active_from || earliest < u.active_from)) {
      await supabase.from("an_units").update({ active_from: earliest }).eq("id", u.id);
    }
  }
}
