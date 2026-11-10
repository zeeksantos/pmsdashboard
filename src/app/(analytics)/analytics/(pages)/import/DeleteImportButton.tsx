"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { iconButton } from "@/components/analytics/ui";
import { deleteImport } from "./actions";

export function DeleteImportButton({ id, fileName, rows }: { id: string; fileName: string; rows: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete import ${fileName}`}
      className={iconButton}
      onClick={() => {
        if (confirm(`Delete "${fileName}" and the ${rows} rows it added? This can't be undone, but you can upload the file again.`)) {
          start(() => deleteImport(id));
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
