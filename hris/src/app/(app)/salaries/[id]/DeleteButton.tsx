"use client";

import { deleteSalary } from "../actions";

export function DeleteButton({ id, employeeId }: { id: string; employeeId: string }) {
  return (
    <form
      action={deleteSalary}
      onSubmit={(e) => {
        if (!confirm("Delete this salary entry? This is recorded in the audit log.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <button className="text-xs text-danger hover:underline">Delete</button>
    </form>
  );
}
