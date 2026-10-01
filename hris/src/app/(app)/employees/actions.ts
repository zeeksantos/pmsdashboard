"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords } from "@/lib/roles";

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function saveEmployee(
  _prev: string | null,
  fd: FormData
): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me || !canManageRecords(me.role)) return "You don't have permission to edit employee records.";

  const id = text(fd, "id");
  const employee_no = text(fd, "employee_no");
  const full_name = text(fd, "full_name");
  const date_hired = text(fd, "date_hired");
  if (!employee_no || !full_name || !date_hired) {
    return "Employee no., full name and date hired are required.";
  }
  if (id && text(fd, "reports_to") === id) return "An employee can't report to themselves.";

  const start = text(fd, "start_time");
  const end = text(fd, "end_time");
  if ((start && !end) || (!start && end)) return "Enter both shift start and end, or leave both blank.";
  if (start && end && end <= start) return "Shift end must be after shift start.";

  const supabase = await createClient();

  // Position: find or create the title within the department.
  const department_id = text(fd, "department_id");
  const title = text(fd, "position_title");
  let position_id: string | null = null;
  if (title) {
    if (!department_id) return "Choose a department for the position.";
    const { data: existing } = await supabase
      .from("positions")
      .select("id")
      .eq("department_id", department_id)
      .eq("title", title)
      .maybeSingle();
    if (existing) {
      position_id = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("positions")
        .insert({ department_id, title })
        .select("id")
        .single();
      if (error) return error.message;
      position_id = created.id;
    }
  }

  const employee = {
    employee_no,
    full_name,
    nickname: text(fd, "nickname"),
    work_email: text(fd, "work_email"),
    department_id,
    position_id,
    reports_to: text(fd, "reports_to"),
    employment_type: text(fd, "employment_type") ?? "REGULAR",
    status: text(fd, "status") ?? "ACTIVE",
    date_hired,
    regularization_date: text(fd, "regularization_date"),
    contract_end_date: text(fd, "contract_end_date"),
    updated_at: new Date().toISOString(),
  };

  let employeeId = id;
  if (id) {
    const { error } = await supabase.from("employees").update(employee).eq("id", id);
    if (error) return friendly(error.message);
  } else {
    const { data, error } = await supabase.from("employees").insert(employee).select("id").single();
    if (error) return friendly(error.message);
    employeeId = data.id;
  }

  const { error: bioError } = await supabase.from("employee_biodata").upsert({
    employee_id: employeeId,
    date_of_birth: text(fd, "date_of_birth"),
    place_of_birth: text(fd, "place_of_birth"),
    gender: text(fd, "gender"),
    civil_status: text(fd, "civil_status"),
    nationality: text(fd, "nationality"),
    phone: text(fd, "phone"),
    personal_email: text(fd, "personal_email"),
    present_address: text(fd, "present_address"),
    city: text(fd, "city"),
    province: text(fd, "province"),
    emergency_contact_name: text(fd, "emergency_contact_name"),
    emergency_contact_relationship: text(fd, "emergency_contact_relationship"),
    emergency_contact_number: text(fd, "emergency_contact_number"),
    sss_no: text(fd, "sss_no"),
    philhealth_no: text(fd, "philhealth_no"),
    pagibig_no: text(fd, "pagibig_no"),
    tin: text(fd, "tin"),
    form_date: text(fd, "form_date"),
    updated_at: new Date().toISOString(),
  });
  if (bioError) return bioError.message;

  if (start && end) {
    const days = fd.getAll("days").map(Number);
    if (days.length === 0) return "Pick at least one working day.";
    const { data: current } = await supabase
      .from("work_schedules")
      .select("id")
      .eq("employee_id", employeeId)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = current
      ? await supabase
          .from("work_schedules")
          .update({ days_of_week: days, start_time: start, end_time: end })
          .eq("id", current.id)
      : await supabase.from("work_schedules").insert({
          employee_id: employeeId,
          days_of_week: days,
          start_time: start,
          end_time: end,
        });
    if (error) return error.message;
  }

  revalidatePath("/employees");
  revalidatePath("/org-chart");
  redirect(`/employees/${employeeId}`);
}

function friendly(message: string) {
  if (message.includes("employees_employee_no_key")) return "That employee number is already in use.";
  return message;
}

export async function linkLogin(
  _prev: string | null,
  fd: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_employee_login", {
    p_employee: String(fd.get("employee_id")),
    p_email: String(fd.get("email") ?? ""),
  });
  if (error) return error.message;
  revalidatePath(`/employees/${fd.get("employee_id")}`);
  return "Login linked.";
}

export async function setRole(
  _prev: string | null,
  fd: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_email: String(fd.get("email") ?? ""),
    p_role: String(fd.get("role")),
  });
  if (error) return error.message;
  return "Role updated.";
}
