"use client";

import { deleteDocument } from "./documents-actions";

export function DeleteDocumentButton({ id, employeeId }: { id: string; employeeId: string }) {
  return (
    <form
      action={deleteDocument}
      onSubmit={(e) => {
        if (!confirm("Delete this document? The file is removed permanently.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <button className="text-xs text-danger hover:underline">Delete</button>
    </form>
  );
}
