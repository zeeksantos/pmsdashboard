import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const [{ data: run }, { data }] = await Promise.all([
    supabase.from("payroll_runs").select("period_start, period_end").eq("id", id).maybeSingle(),
    supabase.from("payslips").select("gross_pay, total_deductions, net_pay, employees(full_name, employee_no)").eq("run_id", id),
  ]);
  if (!run) return new NextResponse("Not found", { status: 404 });

  const rows = (data ?? []) as unknown as {
    gross_pay: number; total_deductions: number; net_pay: number;
    employees: { full_name: string; employee_no: string } | null;
  }[];
  rows.sort((a, b) => (a.employees?.full_name ?? "").localeCompare(b.employees?.full_name ?? ""));

  const body = [
    ["Employee no", "Name", "Gross pay", "Deductions", "Net pay"].map(csv).join(","),
    ...rows.map((r) => [r.employees?.employee_no, r.employees?.full_name, r.gross_pay, r.total_deductions, r.net_pay].map(csv).join(",")),
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payroll-${run.period_start}-to-${run.period_end}.csv"`,
      "cache-control": "no-store",
    },
  });
}
