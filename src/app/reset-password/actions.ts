"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface RequestResetState {
  error: string | null;
  success: boolean;
}

export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required.", success: false };

  const supabase = await createClient();
  // The e-mail's link signs the person in through /auth/callback and lands
  // on the "choose a new password" page. (A numeric code also works when the
  // e-mail template includes one.)
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/auth/callback?next=/reset-password/new` : undefined,
  });
  if (error) return { error: error.message, success: false };

  return { error: null, success: true };
}

export interface ConfirmResetState {
  error: string | null;
}

export async function confirmPasswordReset(
  _prevState: ConfirmResetState,
  formData: FormData
): Promise<ConfirmResetState> {
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !token || !password) return { error: "All fields are required." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });
  if (verifyError) return { error: verifyError.message };

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  redirect("/");
}

export interface NewPasswordState {
  error: string | null;
}

/** Sets a new password for whoever is signed in (via the e-mail link). */
export async function setNewPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "That reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/analytics");
}
