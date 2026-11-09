import Link from "next/link";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { Alert } from "@/lib/analytics/metrics";

const STYLE = {
  high: { Icon: CircleAlert, label: "Urgent", cls: "text-danger" },
  medium: { Icon: TriangleAlert, label: "Check", cls: "text-warning" },
  info: { Icon: Info, label: "Info", cls: "text-accent" },
} as const;

export function AlertList({ alerts, onUnit }: { alerts: Alert[]; onUnit?: (unitId: string) => void }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {alerts.map((a) => {
        const { Icon, label, cls } = STYLE[a.severity];
        return (
          <li key={a.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                <span className={`mr-2 text-xs font-semibold uppercase ${cls}`}>{label}</span>
                {a.unitId && onUnit ? (
                  <button type="button" onClick={() => onUnit(a.unitId!)} className="text-left font-medium hover:text-accent">
                    {a.title}
                  </button>
                ) : a.unitId ? (
                  <Link href={`/analytics?tab=buildings&unit=${a.unitId}`} className="hover:text-accent">
                    {a.title}
                  </Link>
                ) : (
                  a.title
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
