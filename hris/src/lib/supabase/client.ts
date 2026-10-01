import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
