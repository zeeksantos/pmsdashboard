"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/database.types";

export interface BookingFormState {
  error: string | null;
}

const EXCLUSION_VIOLATION = "23P01";

function friendlyBookingError(message: string, code?: string): string {
  if (code === EXCLUSION_VIOLATION) {
    return "This unit is already booked for an overlapping date range. Pick different dates or a different unit.";
  }
  return message;
}

async function resolveGuestId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
): Promise<{ guestId: string } | { error: string }> {
  const existingGuestId = String(formData.get("guest_id") ?? "").trim();
  if (existingGuestId) return { guestId: existingGuestId };

  const newGuestName = String(formData.get("new_guest_name") ?? "").trim();
  if (!newGuestName) return { error: "Select an existing guest or enter a name for a new one." };

  const newGuestPhone = String(formData.get("new_guest_phone") ?? "").trim();
  const newGuestEmail = String(formData.get("new_guest_email") ?? "").trim();

  const { data, error } = await supabase
    .from("guests")
    .insert({
      full_name: newGuestName,
      phone: newGuestPhone || null,
      email: newGuestEmail || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create guest." };
  return { guestId: data.id };
}

function parseBookingForm(formData: FormData) {
  const unit_id = String(formData.get("unit_id") ?? "").trim();
  const check_in = String(formData.get("check_in") ?? "").trim();
  const check_out = String(formData.get("check_out") ?? "").trim();
  const total_amount = Number(formData.get("total_amount"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!unit_id) return { error: "Unit is required." } as const;
  if (!check_in || !check_out) return { error: "Check-in and check-out dates are required." } as const;
  if (check_out <= check_in) return { error: "Check-out must be after check-in." } as const;
  if (!Number.isFinite(total_amount) || total_amount < 0) {
    return { error: "Total amount must be zero or a positive number." } as const;
  }

  return {
    error: null,
    values: { unit_id, check_in, check_out, total_amount, notes: notes || null },
  } as const;
}

export async function createBooking(
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const parsedForm = parseBookingForm(formData);
  if (parsedForm.error) return { error: parsedForm.error };

  const supabase = await createClient();

  const guestResult = await resolveGuestId(supabase, formData);
  if ("error" in guestResult) return { error: guestResult.error };

  const { error } = await supabase.from("bookings").insert({
    ...parsedForm.values,
    guest_id: guestResult.guestId,
  });
  if (error) return { error: friendlyBookingError(error.message, error.code) };

  revalidatePath("/bookings");
  revalidatePath("/guests");
  return { error: null };
}

export async function updateBooking(
  bookingId: string,
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const parsedForm = parseBookingForm(formData);
  if (parsedForm.error) return { error: parsedForm.error };

  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update(parsedForm.values).eq("id", bookingId);
  if (error) return { error: friendlyBookingError(error.message, error.code) };

  revalidatePath("/bookings");
  return { error: null };
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
    throw new Error("Use Check-In / Check-Out to change to this status — it also updates the unit.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);
  if (error) throw new Error(friendlyBookingError(error.message, error.code));
  revalidatePath("/bookings");
}

export async function deleteBooking(bookingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
  if (error) throw new Error(error.message);
  revalidatePath("/bookings");
}
