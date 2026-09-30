"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";

function refresh() {
  revalidatePath("/leave");
  revalidatePath("/leave/approvals");
  revalidatePath("/");
}

export async function requestLeave(_prev: string | null, fd: FormData): Promise<string | null> {
  const start = String(fd.get("start_date") ?? "");
  const end = String(fd.get("end_date") ?? "") || start;
  if (!start) return "Choose a start date.";

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_leave", {
    p_type: String(fd.get("leave_type_id") ?? ""),
    p_start: start,
    p_end: end,
    p_half: fd.get("half_day") === "on",
    p_reason: String(fd.get("reason") ?? ""),
  });
  if (error) return error.message;
  refresh();
  return null;
}

export async function cancelLeave(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_leave", { p_request: String(fd.get("id") ?? "") });
  if (error) return error.message;
  refresh();
  return null;
}

export async function decideLeave(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave", {
    p_request: String(fd.get("id") ?? ""),
    p_approve: fd.get("decision") === "approve",
    p_note: String(fd.get("note") ?? ""),
  });
  if (error) return error.message;
  refresh();
  return null;
}

export async function saveLeaveType(_prev: string | null, fd: FormData): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) return "Not allowed.";

  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const days = Number(fd.get("default_days") ?? 0);
  if (!name) return "Name is required.";
  if (Number.isNaN(days) || days < 0) return "Days must be zero or more.";

  const row = {
    name,
    default_days: days,
    has_balance: fd.get("has_balance") === "on",
    is_paid: fd.get("is_paid") === "on",
    active: fd.get("active") === "on",
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("leave_types").update(row).eq("id", id)
    : await supabase.from("leave_types").insert(row);
  if (error) return error.message.includes("leave_types_name_key") ? "That name already exists." : error.message;
  revalidatePath("/leave/settings");
  revalidatePath("/leave");
  return null;
}

export async function setAllocation(_prev: string | null, fd: FormData): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) return "Not allowed.";

  const employee_id = String(fd.get("employee_id") ?? "");
  const leave_type_id = String(fd.get("leave_type_id") ?? "");
  const year = Number(fd.get("year"));
  const raw = String(fd.get("days") ?? "").trim();
  if (!employee_id || !leave_type_id || !year) return "Choose an employee, a leave type and a year.";

  const supabase = await createClient();
  if (raw === "") {
    // Blank = go back to the leave type's default.
    const { error } = await supabase.from("leave_allocations").delete()
      .eq("employee_id", employee_id).eq("leave_type_id", leave_type_id).eq("year", year);
    if (error) return error.message;
  } else {
    const days = Number(raw);
    if (Number.isNaN(days) || days < 0) return "Days must be zero or more.";
    const { error } = await supabase.from("leave_allocations")
      .upsert({ employee_id, leave_type_id, year, days }, { onConflict: "employee_id,leave_type_id,year" });
    if (error) return error.message;
  }
  revalidatePath("/leave/settings");
  revalidatePath("/leave");
  return null;
}
