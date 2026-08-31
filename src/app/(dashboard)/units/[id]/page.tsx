import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { UNIT_STATUS_STYLES } from "@/lib/status-colors";
import { UnitFormDialog } from "../UnitFormDialog";
import { UnitPhotoManager } from "../UnitPhotoManager";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase.from("units").select("*").eq("id", id).single();
  if (!unit) notFound();

  return (
    <div>
      <Link
        href="/units"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Units & Rates
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{unit.name}</h1>
            <StatusBadge label={unit.status} className={UNIT_STATUS_STYLES[unit.status]} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {unit.unit_type} · Sleeps {unit.max_capacity} · {formatPeso(unit.nightly_rate)}/night
          </p>
          {unit.amenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {unit.amenities.map((a) => (
                <span key={a} className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                  {a}
                </span>
              ))}
            </div>
          )}
          {unit.notes && <p className="mt-2 max-w-xl text-sm text-muted">{unit.notes}</p>}
        </div>
        <UnitFormDialog unit={unit} />
      </div>

      <div className="mt-8">
        <UnitPhotoManager unitId={unit.id} />
      </div>
    </div>
  );
}
