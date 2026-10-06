"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";
import { validateCompanyEvent } from "@/lib/company-events";

export type EventActionState = { ok: boolean; message: string } | null;

export async function addCompanyEvent(_prev: EventActionState, fd: FormData): Promise<EventActionState> {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) return { ok: false, message: "Only HR, admin or owner can add events." };

  const input = {
    title: String(fd.get("title") ?? "").trim(),
    kind: String(fd.get("kind") ?? "EVENT"),
    start: String(fd.get("start_date") ?? ""),
    end: String(fd.get("end_date") ?? ""),
    note: String(fd.get("note") ?? "").trim(),
  };
  const invalid = validateCompanyEvent(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("company_events").insert({
    title: input.title,
    kind: input.kind,
    start_date: input.start,
    end_date: input.end || input.start,
    note: input.note || null,
    created_by: me.userId,
  });
  if (error) {
    return {
      ok: false,
      message: error.message.includes("company_events_title_start_date_key")
        ? "That event is already on the calendar for that date."
        : error.message,
    };
  }
  revalidatePath("/company-calendar");
  revalidatePath("/");
  return { ok: true, message: "Added to the calendar." };
}

export async function deleteCompanyEvent(fd: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) return;
  const supabase = await createClient();
  await supabase.from("company_events").delete().eq("id", String(fd.get("id") ?? ""));
  revalidatePath("/company-calendar");
  revalidatePath("/");
}
