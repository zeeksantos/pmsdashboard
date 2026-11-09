import type { Report } from "@/lib/analytics/report";
import type { FixedCostInput, MonthlyCostInput } from "@/lib/analytics/metrics";

export interface DashCosts {
  fixed: FixedCostInput[];
  monthly: MonthlyCostInput[];
  /** One-off expenses with receipts, per unit and month (YYYY-MM). */
  receipts: { unit_id: string | null; month: string; amount: number }[];
}

export interface DashProps {
  report: Report;
  brand: string;
  periodKey: string;
  periodOptions: { key: string; label: string }[];
  generated: string;
  currency: string;
  canEdit: boolean;
  costs: DashCosts;
  hasUploads: boolean;
}

export interface TabProps extends DashProps {
  m: (n: number) => string;
  openUnit: (id: string) => void;
}
