import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/format";
import { UnitFormDialog } from "./UnitFormDialog";
import { UnitStatusSelect } from "./UnitStatusSelect";
import { DeleteUnitButton } from "./DeleteUnitButton";

export default async function UnitsPage() {
  const supabase = await createClient();
  const { data: units, error } = await supabase
    .from("units")
    .select("*")
    .order("name", { ascending: true });

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: photoRows } =
    unitIds.length > 0
      ? await supabase
          .from("unit_photos")
          .select("unit_id, storage_path, sort_order")
          .in("unit_id", unitIds)
          .order("sort_order", { ascending: true })
      : { data: [] as { unit_id: string; storage_path: string; sort_order: number }[] };

  const coverUrlByUnitId = new Map<string, string>();
  for (const row of photoRows ?? []) {
    if (coverUrlByUnitId.has(row.unit_id)) continue;
    coverUrlByUnitId.set(
      row.unit_id,
      supabase.storage.from("unit-photos").getPublicUrl(row.storage_path).data.publicUrl
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Units & Rates</h1>
          <p className="mt-1 text-sm text-muted">
            Room/unit inventory — every other module references this list.
          </p>
        </div>
        <UnitFormDialog />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load units: {error.message}
        </div>
      )}

      {!error && units && units.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No units yet. Add your first room or unit to get started.
        </div>
      )}

      {!error && units && units.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Nightly rate</th>
                <th className="px-4 py-3 font-medium">Amenities</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 overflow-hidden rounded-md bg-surface-raised">
                      {coverUrlByUnitId.has(unit.id) ? (
                        <Image
                          src={coverUrlByUnitId.get(unit.id)!}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 object-cover"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/units/${unit.id}`} className="hover:text-accent hover:underline">
                      {unit.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{unit.unit_type}</td>
                  <td className="px-4 py-3 text-muted">{unit.max_capacity}</td>
                  <td className="px-4 py-3 text-foreground">{formatPeso(unit.nightly_rate)}</td>
                  <td className="px-4 py-3 text-muted">
                    {unit.amenities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {unit.amenities.map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-surface-raised px-2 py-0.5 text-xs"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <UnitStatusSelect unitId={unit.id} status={unit.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <UnitFormDialog unit={unit} />
                      <DeleteUnitButton unitId={unit.id} unitName={unit.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
