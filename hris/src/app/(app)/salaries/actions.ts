"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canViewSalaries } from "@/lib/roles";

const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : Number(v);
};

export async function addSalary(
  _prev: string | null,
  fd: FormData
): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me || !canViewSalaries(me.role)) return "You don't have permission to edit salaries.";

  const employee_id = String(fd.get("employee_id") ?? "");
  const effective_from = String(fd.get("effective_from") ?? "");
  const monthly_rate = num(fd, "monthly_rate");
  const hourly_rate = num(fd, "hourly_rate");

  if (!employee_id || !effective_from) return "Effective date is required.";
  if (monthly_rate == null && hourly_rate == null) return "Enter a monthly rate, an hourly rate, or both.";
  if ([monthly_rate, hourly_rate].some((n) => n != null && (Number.isNaN(n) || n < 0))) {
    return "Rates must be zero or more.";
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_salaries")
    .insert({ employee_id, effective_from, monthly_rate, hourly_rate });
  if (error) {
    if (error.message.includes("salary_one_per_date")) {
      return "There's already a salary with that effective date. Pick a different date or delete the old entry.";
    }
    return error.message;
  }

  revalidatePath("/salaries");
  revalidatePath(`/salaries/${employee_id}`);
  return null;
}

export async function deleteSalary(fd: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !canViewSalaries(me.role)) return;

  const id = String(fd.get("id") ?? "");
  const employee_id = String(fd.get("employee_id") ?? "");
  const supabase = await createClient();
  await supabase.from("employee_salaries").delete().eq("id", id);

  revalidatePath("/salaries");
  revalidatePath(`/salaries/${employee_id}`);
}
