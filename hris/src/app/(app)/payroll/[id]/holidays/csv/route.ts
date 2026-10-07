import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { HOLIDAY_CODES } from "@/lib/holiday-report";
import { loadHolidayReport } from "../data";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) return new NextResponse("Not found", { status: 404 });
  const report = await loadHolidayReport(id);
  if (!report) return new NextResponse("Not found", { status: 404 });
  const { run, summary } = report;

  const header = [
    "Employee no", "Name", "Regular holiday worked (days)", "Special non-working worked (days)",
    "Regular holiday on rest day (days)", "Special on rest day (days)", "Paid, not worked (days)", "Premium pay",
  ];
  const body = [
    header.map(csv).join(","),
    ...summary.rows.map((r) =>
      [
        r.employee_no, r.name, ...HOLIDAY_CODES.map((c) => r.days[c]), r.paidUnworked, r.total,
      ].map(csv).join(",")
    ),
    ["", "Total", ...HOLIDAY_CODES.map((c) => summary.totals.days[c]), summary.totals.paidUnworked, summary.totals.total]
      .map(csv).join(","),
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="holiday-pay-${run.period_start}-to-${run.period_end}.csv"`,
      "cache-control": "no-store",
    },
  });
}
