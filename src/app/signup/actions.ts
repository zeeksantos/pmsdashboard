"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SignUpState {
  error: string | null;
  checkEmail?: string;
}

export async function signUp(_prev: SignUpState, fd: FormData): Promise<SignUpState> {
  const fullName = String(fd.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!fullName) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid e-mail address." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // New accounts get the analytics_only role (no PMS access) — see
      // supabase/migrations/0010_analytics.sql.
      data: { full_name: fullName },
      emailRedirectTo: origin ? `${origin}/auth/callback?next=/analytics` : undefined,
    },
  });
  if (error) return { error: error.message };

  // With e-mail confirmation on (Supabase default) there's no session yet.
  if (!data.session) return { error: null, checkEmail: email };
  redirect("/analytics");
}
