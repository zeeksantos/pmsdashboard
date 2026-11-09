"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditableWorkspace } from "@/lib/analytics/workspace";
import { EXPENSE_CATEGORIES } from "@/lib/analytics/categories";

export interface ExpenseFormState {
  error: string | null;
  ok?: boolean;
}

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export async function addExpense(_prev: ExpenseFormState, fd: FormData): Promise<ExpenseFormState> {
  let ws;
  try {
    ws = await requireEditableWorkspace();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const category = String(fd.get("category") ?? "");
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { error: "Pick a category." };
  const amount = Number(fd.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than zero." };
  const spentOn = String(fd.get("spent_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return { error: "Pick the date you paid it." };
  const unitId = String(fd.get("unit_id") ?? "") || null;
  const description = String(fd.get("description") ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  let receiptPath: string | null = null;
  const receipt = fd.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    if (receipt.size > MAX_RECEIPT_BYTES) return { error: "Receipts can be up to 8 MB." };
    if (!RECEIPT_TYPES.includes(receipt.type)) return { error: "Upload the receipt as a photo (JPG, PNG, HEIC) or PDF." };
    const safeName = receipt.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    receiptPath = `${ws.workspace.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("an-receipts")
      .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false });
    if (upErr) return { error: `Receipt upload failed: ${upErr.message}` };
  }

  const { error } = await supabase.from("an_expenses").insert({
    workspace_id: ws.workspace.id,
    unit_id: unitId,
    category,
    amount,
    spent_on: spentOn,
    description,
    receipt_path: receiptPath,
    created_by: ws.userId,
  });
  if (error) {
    if (receiptPath) await supabase.storage.from("an-receipts").remove([receiptPath]);
    return { error: error.message };
  }

  revalidatePath("/analytics", "layout");
  return { error: null, ok: true };
}

export async function deleteExpense(expenseId: string) {
  const ws = await requireEditableWorkspace();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("an_expenses")
    .select("receipt_path")
    .eq("id", expenseId)
    .eq("workspace_id", ws.workspace.id)
    .single();
  const { error } = await supabase.from("an_expenses").delete().eq("id", expenseId).eq("workspace_id", ws.workspace.id);
  if (error) throw new Error(error.message);
  if (row?.receipt_path) await supabase.storage.from("an-receipts").remove([row.receipt_path]);
  revalidatePath("/analytics", "layout");
}
