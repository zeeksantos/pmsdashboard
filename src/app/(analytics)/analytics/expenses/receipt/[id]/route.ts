import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Receipts live in a private bucket; hand out a short-lived signed link to
// members of the expense's workspace (RLS decides who can read the row).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: expense } = await supabase.from("an_expenses").select("receipt_path").eq("id", id).maybeSingle();
  if (!expense?.receipt_path) return new NextResponse("Receipt not found", { status: 404 });

  const { data, error } = await supabase.storage.from("an-receipts").createSignedUrl(expense.receipt_path, 120);
  if (error || !data) return new NextResponse("Receipt not available", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
