import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { ContactForm, type Contact } from "./ContactForm";
import { PasswordForm } from "./PasswordForm";

const s = (v: unknown) => (v == null ? "" : String(v));

export default async function AccountPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  let contact: Contact | null = null;
  if (me.employee) {
    const supabase = await createClient();
    const [{ data: emp }, { data: bio }] = await Promise.all([
      supabase.from("employees").select("nickname").eq("id", me.employee.id).maybeSingle(),
      supabase.from("employee_biodata").select("*").eq("employee_id", me.employee.id).maybeSingle(),
    ]);
    const b = bio ?? {};
    contact = {
      nickname: s(emp?.nickname),
      phone: s(b.phone),
      personal_email: s(b.personal_email),
      present_address: s(b.present_address),
      city: s(b.city),
      province: s(b.province),
      emergency_contact_name: s(b.emergency_contact_name),
      emergency_contact_relationship: s(b.emergency_contact_relationship),
      emergency_contact_number: s(b.emergency_contact_number),
    };
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My Account</h1>
        {me.employee && (
          <p className="mt-1 text-sm text-muted">
            {me.employee.full_name} · {me.employee.employee_no} ·{" "}
            <Link href={`/employees/${me.employee.id}`} className="text-accent hover:underline">View my profile</Link>
          </p>
        )}
      </div>

      {contact ? (
        <>
          <ContactForm values={contact} />
          <p className="text-xs text-muted">
            Your name, birthdate, marital status, government numbers, position and salary can only be
            changed by HR. Tell them if any of those need correcting.
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Your login isn&apos;t linked to an employee record, so there are no contact details to edit. Ask an admin or HR.
        </p>
      )}

      {me.email && <PasswordForm email={me.email} />}
    </div>
  );
}
