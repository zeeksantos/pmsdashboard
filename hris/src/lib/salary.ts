export type Salary = { monthly_rate: number | null; hourly_rate: number | null; effective_from: string };

// Latest salary whose effective date has arrived.
export function currentSalary<T extends Salary>(list: T[], today: string): T | null {
  return (
    [...list]
      .filter((s) => s.effective_from <= today)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
  );
}
