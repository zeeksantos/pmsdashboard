"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md px-3 py-1.5 text-left text-xs font-medium text-muted hover:bg-surface-raised hover:text-foreground"
    >
      Sign out
    </button>
  );
}
