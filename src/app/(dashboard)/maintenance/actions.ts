"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MaintenancePriority, MaintenanceStatus } from "@/lib/database.types";

export interface TicketFormState {
  error: string | null;
}

function parseTicketForm(formData: FormData) {
  const unit_id = String(formData.get("unit_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM") as MaintenancePriority;
  const assigned_to = String(formData.get("assigned_to") ?? "").trim();

  if (!unit_id) return { error: "Unit is required." } as const;
  if (!title) return { error: "Title is required." } as const;

  return {
    error: null,
    values: {
      unit_id,
      title,
      description: description || null,
      priority,
      assigned_to: assigned_to || null,
    },
  } as const;
}

export async function createTicket(_prevState: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const parsed = parseTicketForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_tickets").insert(parsed.values);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { error: null };
}

export async function updateTicket(
  ticketId: string,
  _prevState: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const parsed = parseTicketForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_tickets").update(parsed.values).eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { error: null };
}

export async function updateTicketStatus(ticketId: string, status: MaintenanceStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_tickets")
    .update({
      status,
      resolved_at: status === "RESOLVED" ? new Date().toISOString() : null,
    })
    .eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
}

export async function deleteTicket(ticketId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_tickets").delete().eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
}
