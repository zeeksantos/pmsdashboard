"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/database.types";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export interface PaymentFormState {
  error: string | null;
}

export async function recordPayment(
  bookingId: string,
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  const reference_no = String(formData.get("reference_no") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." };
  }
  if (!PAYMENT_METHODS.includes(method)) {
    return { error: "Select a valid payment method." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount,
    method,
    reference_no: reference_no || null,
    notes: notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/billing/${bookingId}`);
  revalidatePath("/billing");
  revalidatePath("/guests");
  revalidatePath(`/bookings/${bookingId}/receipt`);
  return { error: null };
}

export async function deletePayment(paymentId: string, bookingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/billing/${bookingId}`);
  revalidatePath("/billing");
  revalidatePath("/guests");
  revalidatePath(`/bookings/${bookingId}/receipt`);
}
