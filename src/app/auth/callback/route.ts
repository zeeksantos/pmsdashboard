import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing page for links in Supabase auth e-mails (sign-up confirmation).
// Exchanges the one-time code for a session, then continues to `next`.
// The deployed URL must be listed under Authentication → URL Configuration
// → Redirect URLs in Supabase, or the e-mail link falls back to the Site URL.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/analytics";
  // Only allow same-site paths.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/analytics";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // Expired or already-used link: the e-mail is usually confirmed anyway,
  // so send them to sign in.
  const login = new URL("/login", url.origin);
  login.searchParams.set("confirmed", "1");
  return NextResponse.redirect(login);
}
