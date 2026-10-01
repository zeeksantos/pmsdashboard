"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeCode, validateNewPassword } from "@/lib/password";

export type RequestState = { error: string | null; email: string | null };

// Always answers the same way whether or not the email has an account,
// so this can't be used to find out who works here.
export async function requestReset(_prev: RequestState, fd: FormData): Promise<RequestState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address.", email: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  // Only surface rate limiting; anything else looks like success.
  if (error && (error.status === 429 || /rate limit|too many/i.test(error.message))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email: null };
  }
  return { error: null, email };
}

export async function confirmReset(_prev: string | null, fd: FormData): Promise<string | null> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const code = normalizeCode(String(fd.get("code") ?? ""));
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (!email) return "Start again and enter your email.";
  if (!code) return "Enter the numeric code from the email.";
  const invalid = validateNewPassword(password, confirm);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verifyError) return "That code is wrong or has expired. Request a new one.";

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return `${updateError.message} The code is now used up, so request a new one.`;

  // Sign out anywhere else this account was logged in.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/");
}
