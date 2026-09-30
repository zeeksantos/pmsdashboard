"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";
import { DOCUMENT_BUCKET } from "@/lib/employees";

export async function deleteDocument(fd: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) return;

  const id = String(fd.get("id") ?? "");
  const employeeId = String(fd.get("employee_id") ?? "");
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("employee_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return;

  // Remove the file first; if that fails keep the record so nothing is orphaned.
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.file_path]);
  if (error) return;
  await supabase.from("employee_documents").delete().eq("id", id);

  revalidatePath(`/employees/${employeeId}`);
}
