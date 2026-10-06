import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";
import { EmployeeForm } from "../../EmployeeForm";
import { blankEmployee, loadFormOptions } from "../../form-data";
import { LoginAccess } from "./LoginAccess";
import type { EmployeeFormValues } from "@/lib/employees";

const s = (v: unknown) => (v == null ? "" : String(v));

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ loginError?: string }>;
}) {
  const { id } = await params;
  const { loginError } = await searchParams;
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) notFound();

  const supabase = await createClient();
  const [{ data: emp }, { data: bio }, { data: sched }, options] = await Promise.all([
    supabase.from("employees").select("*, positions(title)").eq("id", id).maybeSingle(),
    supabase.from("employee_biodata").select("*").eq("employee_id", id).maybeSingle(),
    supabase
      .from("work_schedules")
      .select("days_of_week, start_time, end_time")
      .eq("employee_id", id)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadFormOptions(),
  ]);
  if (!emp) notFound();

  const b = bio ?? {};
  const values: EmployeeFormValues = {
    ...blankEmployee,
    id,
    employee_no: s(emp.employee_no),
    full_name: s(emp.full_name),
    nickname: s(emp.nickname),
    work_email: s(emp.work_email),
    department_id: s(emp.department_id),
    position_title: s(emp.positions?.title),
    reports_to: s(emp.reports_to),
    employment_type: s(emp.employment_type),
    status: s(emp.status),
    date_hired: s(emp.date_hired),
    regularization_date: s(emp.regularization_date),
    contract_end_date: s(emp.contract_end_date),
    date_of_birth: s(b.date_of_birth),
    place_of_birth: s(b.place_of_birth),
    gender: s(b.gender),
    civil_status: s(b.civil_status),
    nationality: s(b.nationality),
    phone: s(b.phone),
    personal_email: s(b.personal_email),
    present_address: s(b.present_address),
    city: s(b.city),
    province: s(b.province),
    emergency_contact_name: s(b.emergency_contact_name),
    emergency_contact_relationship: s(b.emergency_contact_relationship),
    emergency_contact_number: s(b.emergency_contact_number),
    sss_no: s(b.sss_no),
    philhealth_no: s(b.philhealth_no),
    pagibig_no: s(b.pagibig_no),
    tin: s(b.tin),
    form_date: s(b.form_date),
    start_time: sched ? s(sched.start_time).slice(0, 5) : "",
    end_time: sched ? s(sched.end_time).slice(0, 5) : "",
    days: sched ? sched.days_of_week : [],
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit {emp.full_name}</h1>
      {loginError && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          The employee was saved, but the login could not be created: {loginError}. You can create it on the Users page.
        </p>
      )}
      <LoginAccess
        employeeId={id}
        linked={Boolean(emp.user_id)}
        canSetRole={me.role === "admin" || me.role === "owner"}
        isOwner={me.role === "owner"}
      />
      <EmployeeForm
        values={values}
        departments={options.departments}
        positionTitles={options.positionTitles}
        managers={options.managers.filter((m) => m.id !== id)}
      />
    </div>
  );
}
