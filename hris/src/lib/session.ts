import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type CurrentUser = {
  userId: string;
  email: string | undefined;
  role: Role;
  employee: { id: string; full_name: string; employee_no: string } | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: roleRow }, { data: employee }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("employees")
      .select("id, full_name, employee_no")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    email: user.email,
    role: (roleRow?.role ?? "employee") as Role,
    employee,
  };
});
