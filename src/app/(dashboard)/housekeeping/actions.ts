"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAffected() {
  revalidatePath("/housekeeping");
  revalidatePath("/units");
  revalidatePath("/calendar");
  revalidatePath("/check-in-out");
}

export async function startTask(taskId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_housekeeping_task", { p_task_id: taskId });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("housekeeping_tasks").update({ assigned_to: user.id }).eq("id", taskId);
  }

  revalidateAffected();
  return { error: null };
}

export async function completeTask(taskId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_housekeeping_task", { p_task_id: taskId });
  if (error) return { error: error.message };

  revalidateAffected();
  return { error: null };
}
