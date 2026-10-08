"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/overtime");
  revalidatePath("/overtime/approvals");
}

export async function requestOvertime(_prev: string | null, fd: FormData): Promise<string | null> {
  const date = String(fd.get("work_date") ?? "");
  const hours = Number(fd.get("hours"));
  if (!date) return "Choose the date you worked overtime.";
  if (!Number.isFinite(hours) || hours <= 0 || hours > 12) return "Enter overtime hours between 0.25 and 12.";

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_overtime", {
    p_date: date, p_hours: hours, p_reason: String(fd.get("reason") ?? ""),
  });
  if (error) return error.message;
  refresh();
  return null;
}

export async function cancelOvertime(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_overtime", { p_request: String(fd.get("id") ?? "") });
  if (error) return error.message;
  refresh();
  return null;
}

export async function decideOvertime(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_overtime", {
    p_request: String(fd.get("id") ?? ""),
    p_approve: fd.get("decision") === "approve",
    p_note: String(fd.get("note") ?? ""),
  });
  if (error) return error.message;
  refresh();
  return null;
}
