import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords, canManageUsers } from "@/lib/roles";
import { EmployeeForm } from "../EmployeeForm";
import { blankEmployee, loadFormOptions, nextEmployeeNo } from "../form-data";

export default async function NewEmployeePage() {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) notFound();

  const [options, employee_no] = await Promise.all([loadFormOptions(), nextEmployeeNo()]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Add employee</h1>
      <EmployeeForm
        values={{ ...blankEmployee, employee_no }}
        {...options}
        canCreateLogin={canManageUsers(me.role)}
        isOwner={me.role === "owner"}
      />
    </div>
  );
}
