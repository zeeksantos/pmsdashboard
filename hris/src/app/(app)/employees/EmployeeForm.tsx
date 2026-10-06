"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveEmployee } from "./actions";
import {
  civilStatuses,
  employmentStatuses,
  employmentTypes,
  endDatedTypes,
  genders,
  label,
  weekdays,
  type EmployeeFormValues,
} from "@/lib/employees";
import { roleLabels, type Role } from "@/lib/roles";
import { generatePassword } from "@/lib/password";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

function Field({ name, children, wide }: { name: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="mb-1.5 block text-sm text-muted">{name}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function EmployeeForm({
  values,
  departments,
  positionTitles,
  managers,
  loginRoles = [],
}: {
  values: EmployeeFormValues;
  departments: { id: string; name: string }[];
  positionTitles: string[];
  managers: { id: string; full_name: string }[];
  loginRoles?: Role[];
}) {
  const [error, formAction, pending] = useActionState(saveEmployee, null);
  const [employmentType, setEmploymentType] = useState(values.employment_type);
  const [loginPassword, setLoginPassword] = useState("");
  const v = values;

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}

      {loginRoles.length > 0 && !v.id && (
        <Section title="Sign-in login">
          <Field name="Login email *">
            <input name="login_email" type="email" required autoComplete="off" className={input} />
          </Field>
          <Field name="Temporary password * (min. 8 characters)">
            <div className="flex gap-2">
              <input
                name="login_password" type="text" required minLength={8} autoComplete="off"
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={input}
              />
              <button type="button" onClick={() => setLoginPassword(generatePassword())}
                className="shrink-0 rounded-lg bg-surface-raised px-3 py-2 text-sm hover:bg-border">
                Generate
              </button>
            </div>
          </Field>
          <Field name="Access level *">
            <select name="login_role" defaultValue="employee" className={input}>
              {loginRoles.map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </Field>
          <p className="self-end text-xs text-muted">
            Share the email and password with them privately. They can change the password under Settings.
          </p>
        </Section>
      )}

      <Section title="Work information">
        <Field name="Employee no. *">
          <input name="employee_no" required defaultValue={v.employee_no} className={input} />
        </Field>
        <Field name="Full name *">
          <input name="full_name" required defaultValue={v.full_name} className={input} />
        </Field>
        <Field name="Nickname">
          <input name="nickname" defaultValue={v.nickname} className={input} />
        </Field>
        <Field name="Work email">
          <input name="work_email" type="email" defaultValue={v.work_email} className={input} />
        </Field>
        <Field name="Department">
          <select name="department_id" defaultValue={v.department_id} className={input}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field name="Position">
          <input name="position_title" list="positions" defaultValue={v.position_title} className={input} />
          <datalist id="positions">
            {positionTitles.map((t) => (<option key={t} value={t} />))}
          </datalist>
        </Field>
        <Field name="Reports to">
          <select name="reports_to" defaultValue={v.reports_to} className={input}>
            <option value="">— none (top of chart)</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </Field>
        <Field name="Employment type">
          <select
            name="employment_type"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
            className={input}
          >
            {employmentTypes.map((t) => (<option key={t} value={t}>{label(t)}</option>))}
          </select>
        </Field>
        <Field name="Status">
          <select name="status" defaultValue={v.status} className={input}>
            {employmentStatuses.map((s) => (<option key={s} value={s}>{label(s)}</option>))}
          </select>
        </Field>
        <Field name="Date hired *">
          <input name="date_hired" type="date" required defaultValue={v.date_hired} className={input} />
        </Field>
        <Field name="Regularization date">
          <input name="regularization_date" type="date" defaultValue={v.regularization_date} className={input} />
        </Field>
        {endDatedTypes.includes(employmentType) && (
          <Field name={employmentType === "PROJECT_BASED" ? "Project end date" : "Contract end date"}>
            <input name="contract_end_date" type="date" defaultValue={v.contract_end_date} className={input} />
          </Field>
        )}
      </Section>

      <Section title="Work schedule">
        <Field name="Shift start">
          <input name="start_time" type="time" defaultValue={v.start_time} className={input} />
        </Field>
        <Field name="Shift end">
          <input name="end_time" type="time" defaultValue={v.end_time} className={input} />
        </Field>
        <Field name="Working days" wide>
          <div className="flex flex-wrap gap-3">
            {weekdays.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="days" value={d.value} defaultChecked={v.days.includes(d.value)} />
                {d.label}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Personal information">
        <Field name="Date of birth">
          <input name="date_of_birth" type="date" defaultValue={v.date_of_birth} className={input} />
        </Field>
        <Field name="Place of birth">
          <input name="place_of_birth" defaultValue={v.place_of_birth} className={input} />
        </Field>
        <Field name="Gender">
          <select name="gender" defaultValue={v.gender} className={input}>
            <option value="">—</option>
            {genders.map((g) => (<option key={g} value={g}>{label(g)}</option>))}
          </select>
        </Field>
        <Field name="Marital status">
          <select name="civil_status" defaultValue={v.civil_status} className={input}>
            <option value="">—</option>
            {civilStatuses.map((c) => (<option key={c} value={c}>{label(c)}</option>))}
          </select>
        </Field>
        <Field name="Nationality">
          <input name="nationality" defaultValue={v.nationality} className={input} />
        </Field>
        <Field name="Phone">
          <input name="phone" type="tel" defaultValue={v.phone} className={input} />
        </Field>
        <Field name="Personal email" wide>
          <input name="personal_email" type="email" defaultValue={v.personal_email} className={input} />
        </Field>
      </Section>

      <Section title="Address">
        <Field name="Present address" wide>
          <input name="present_address" defaultValue={v.present_address} className={input} />
        </Field>
        <Field name="City">
          <input name="city" defaultValue={v.city} className={input} />
        </Field>
        <Field name="Province">
          <input name="province" defaultValue={v.province} className={input} />
        </Field>
      </Section>

      <Section title="Emergency contact">
        <Field name="Contact person">
          <input name="emergency_contact_name" defaultValue={v.emergency_contact_name} className={input} />
        </Field>
        <Field name="Relationship">
          <input name="emergency_contact_relationship" defaultValue={v.emergency_contact_relationship} className={input} />
        </Field>
        <Field name="Contact number">
          <input name="emergency_contact_number" type="tel" defaultValue={v.emergency_contact_number} className={input} />
        </Field>
      </Section>

      <Section title="Government numbers">
        <Field name="SSS no.">
          <input name="sss_no" defaultValue={v.sss_no} className={input} />
        </Field>
        <Field name="PhilHealth no.">
          <input name="philhealth_no" defaultValue={v.philhealth_no} className={input} />
        </Field>
        <Field name="Pag-IBIG no.">
          <input name="pagibig_no" defaultValue={v.pagibig_no} className={input} />
        </Field>
        <Field name="TIN">
          <input name="tin" defaultValue={v.tin} className={input} />
        </Field>
        <Field name="Biodata form date">
          <input name="form_date" type="date" defaultValue={v.form_date} className={input} />
        </Field>
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : v.id ? "Save changes" : "Add employee"}
        </button>
        <Link
          href={v.id ? `/employees/${v.id}` : "/employees"}
          className="rounded-lg border border-border px-5 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
