export const employmentTypes = ["REGULAR", "CONTRACTUAL", "PART_TIME"] as const;
export const employmentStatuses = ["ACTIVE", "ON_LEAVE", "RESIGNED", "TERMINATED"] as const;
export const civilStatuses = ["SINGLE", "MARRIED", "WIDOWED", "SEPARATED"] as const;
export const genders = ["MALE", "FEMALE"] as const;

export const weekdays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

// "09:00:00" -> "9:00 AM"
export function formatClock(t: string | null | undefined): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

export type EmployeeFormValues = {
  id?: string;
  employee_no: string;
  full_name: string;
  nickname: string;
  work_email: string;
  department_id: string;
  position_title: string;
  reports_to: string;
  employment_type: string;
  status: string;
  date_hired: string;
  regularization_date: string;
  contract_end_date: string;
  date_of_birth: string;
  place_of_birth: string;
  gender: string;
  civil_status: string;
  nationality: string;
  phone: string;
  personal_email: string;
  present_address: string;
  city: string;
  province: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_number: string;
  sss_no: string;
  philhealth_no: string;
  pagibig_no: string;
  tin: string;
  form_date: string;
  start_time: string;
  end_time: string;
  days: number[];
};
