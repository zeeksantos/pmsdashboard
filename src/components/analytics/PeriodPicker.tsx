"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PeriodPicker({ value, options }: { value: string; options: { key: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      aria-label="Period"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("period", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
