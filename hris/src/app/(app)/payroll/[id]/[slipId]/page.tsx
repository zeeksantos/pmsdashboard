import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManagePayroll } from "@/lib/roles";
import { PayslipView, type SlipLine } from "@/components/PayslipView";

export default async function StaffPayslipPage({ params }: { params: Promise<{ id: string; slipId: string }> }) {
  const { id, slipId } = await params;
  const me = await getCurrentUser();
  if (!me || !canManagePayroll(me.role)) notFound();

  const supabase = await createClient();
  const [{ data: run }, { data: slip }] = await Promise.all([
    supabase.from("payroll_runs").select("period_start, period_end, pay_date, label, status").eq("id", id).maybeSingle(),
    supabase
      .from("payslips")
      .select("id, run_id, gross_pay, total_deductions, net_pay, snapshot, employees(full_name, employee_no), payslip_lines(id, kind, code, label, amount, is_manual, sort_order)")
      .eq("id", slipId).eq("run_id", id).maybeSingle(),
  ]);
  if (!run || !slip) notFound();
  const s = slip as unknown as {
    id: string; gross_pay: number; total_deductions: number; net_pay: number;
    snapshot: Record<string, number | string> | null;
    employees: { full_name: string; employee_no: string };
    payslip_lines: SlipLine[];
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/payroll/${id}`} className="text-sm text-muted hover:text-foreground print:hidden">← Back to run</Link>
      <PayslipView
        employee={s.employees} run={run}
        slip={{ id: s.id, gross_pay: Number(s.gross_pay), total_deductions: Number(s.total_deductions), net_pay: Number(s.net_pay), snapshot: s.snapshot }}
        lines={s.payslip_lines.map((l) => ({ ...l, amount: Number(l.amount) }))}
        canEdit={run.status === "DRAFT"} showEmployer
      />
    </div>
  );
}
