"use client";

import { useRouter } from "next/navigation";

export function MonthPicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  return (
    <input
      type="month"
      aria-label="Statement month"
      value={value}
      max={max}
      onChange={(e) => e.target.value && router.push(`?month=${e.target.value}`)}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
    />
  );
}
