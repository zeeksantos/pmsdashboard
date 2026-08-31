"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAffected() {
  revalidatePath("/check-in-out");
  revalidatePath("/units");
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath("/housekeeping");
}

export async function checkInBooking(bookingId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in_booking", { p_booking_id: bookingId });
  if (error) return { error: error.message };
  revalidateAffected();
  return { error: null };
}

export async function checkOutBooking(bookingId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkout_booking", { p_booking_id: bookingId });
  if (error) return { error: error.message };
  revalidateAffected();
  return { error: null };
}
