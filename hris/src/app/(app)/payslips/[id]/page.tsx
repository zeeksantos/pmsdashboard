import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { PayslipView, type SlipLine } from "@/components/PayslipView";
import { PrintButton } from "@/components/PrintButton";

export default async function MyPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me?.employee) notFound();

  // RLS: only your own payslip, and only once its run is finalized.
  const supabase = await createClient();
  const { data: slip } = await supabase
    .from("payslips")
    .select("id, run_id, gross_pay, total_deductions, net_pay, snapshot, employees(full_name, employee_no), payslip_lines(id, kind, code, label, amount, is_manual, sort_order)")
    .eq("id", id).eq("employee_id", me.employee.id).maybeSingle();
  if (!slip) notFound();

  const s = slip as unknown as {
    id: string; run_id: string; gross_pay: number; total_deductions: number; net_pay: number;
    snapshot: Record<string, number | string> | null;
    employees: { full_name: string; employee_no: string };
    payslip_lines: SlipLine[];
  };
  const { data: run } = await supabase
    .from("payroll_runs").select("period_start, period_end, pay_date, label").eq("id", s.run_id).maybeSingle();
  if (!run) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/payslips" className="text-sm text-muted hover:text-foreground">← My payslips</Link>
        <PrintButton />
      </div>
      <PayslipView
        employee={s.employees} run={run}
        slip={{ id: s.id, gross_pay: Number(s.gross_pay), total_deductions: Number(s.total_deductions), net_pay: Number(s.net_pay), snapshot: s.snapshot }}
        lines={s.payslip_lines.map((l) => ({ ...l, amount: Number(l.amount) })).filter((l) => l.kind !== "EMPLOYER")}
        canEdit={false} showEmployer={false}
      />
    </div>
  );
}
