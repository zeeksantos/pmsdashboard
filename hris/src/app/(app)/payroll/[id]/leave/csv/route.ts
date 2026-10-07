import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { loadLeaveReport } from "../data";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) return new NextResponse("Not found", { status: 404 });
  const report = await loadLeaveReport(id);
  if (!report) return new NextResponse("Not found", { status: 404 });
  const { run, summary } = report;

  const header = ["Employee no", "Name", "Leave", "Paid days", "Paid leave pay", "Unpaid days", "Pay withheld"];
  const body = [
    header.map(csv).join(","),
    ...summary.rows.map((r) =>
      [
        r.employee_no, r.name, r.types.map((t) => `${t.leave_type} ${t.days}`).join("; "),
        r.paidDays, r.paidValue, r.unpaidDays, r.unpaidValue,
      ].map(csv).join(",")
    ),
    ["", "Total", "", summary.totals.paidDays, summary.totals.paidValue, summary.totals.unpaidDays, summary.totals.unpaidValue]
      .map(csv).join(","),
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leave-pay-${run.period_start}-to-${run.period_end}.csv"`,
      "cache-control": "no-store",
    },
  });
}
