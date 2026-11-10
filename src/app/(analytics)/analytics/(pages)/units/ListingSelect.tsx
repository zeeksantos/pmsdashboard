"use client";

import { useTransition } from "react";
import { inputClass } from "@/components/analytics/ui";
import { linkListing } from "./actions";

export function ListingSelect({
  listingId,
  unitId,
  units,
  disabled,
}: {
  listingId: string;
  unitId: string | null;
  units: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Linked unit"
      value={unitId ?? ""}
      disabled={disabled || pending}
      onChange={(e) => start(() => linkListing(listingId, e.target.value))}
      className={`${inputClass} py-1.5 ${!unitId ? "border-warning/60" : ""}`}
    >
      <option value="">— not linked —</option>
      <option value="new">+ New unit with this name</option>
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
