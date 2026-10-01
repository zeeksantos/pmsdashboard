import { createClient } from "@/lib/supabase/server";
import type { EmployeeFormValues } from "@/lib/employees";

export const blankEmployee: EmployeeFormValues = {
  employee_no: "", full_name: "", nickname: "", work_email: "", department_id: "",
  position_title: "", reports_to: "", employment_type: "REGULAR", status: "ACTIVE",
  date_hired: "", regularization_date: "", contract_end_date: "", date_of_birth: "",
  place_of_birth: "", gender: "", civil_status: "", nationality: "Filipino", phone: "",
  personal_email: "", present_address: "", city: "", province: "",
  emergency_contact_name: "", emergency_contact_relationship: "", emergency_contact_number: "",
  sss_no: "", philhealth_no: "", pagibig_no: "", tin: "", form_date: "",
  start_time: "09:00", end_time: "18:00", days: [1, 2, 3, 4, 5],
};

export async function loadFormOptions() {
  const supabase = await createClient();
  const [{ data: departments }, { data: positions }, { data: managers }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("positions").select("title"),
    supabase.from("employees").select("id, full_name").order("full_name"),
  ]);
  return {
    departments: departments ?? [],
    positionTitles: [...new Set((positions ?? []).map((p) => p.title))].sort(),
    managers: managers ?? [],
  };
}

export async function nextEmployeeNo(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("employee_no");
  const max = (data ?? []).reduce((m, r) => {
    const n = /^ZF-(\d+)$/.exec(r.employee_no)?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return `ZF-${String(max + 1).padStart(3, "0")}`;
}
