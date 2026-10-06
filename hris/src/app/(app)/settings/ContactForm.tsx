"use client";

import { useActionState } from "react";
import { saveContact } from "./actions";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export type Contact = {
  nickname: string;
  phone: string;
  personal_email: string;
  present_address: string;
  city: string;
  province: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_number: string;
};

function Field({ name, children, wide }: { name: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="mb-1.5 block text-sm text-muted">{name}</label>
      {children}
    </div>
  );
}

export function ContactForm({ values }: { values: Contact }) {
  const [msg, action, pending] = useActionState(saveContact, null);
  const v = values;
  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold">Contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="Nickname"><input name="nickname" defaultValue={v.nickname} className={input} /></Field>
          <Field name="Phone"><input name="phone" type="tel" defaultValue={v.phone} className={input} /></Field>
          <Field name="Personal email" wide>
            <input name="personal_email" type="email" defaultValue={v.personal_email} className={input} />
          </Field>
          <Field name="Present address" wide>
            <input name="present_address" defaultValue={v.present_address} className={input} />
          </Field>
          <Field name="City"><input name="city" defaultValue={v.city} className={input} /></Field>
          <Field name="Province"><input name="province" defaultValue={v.province} className={input} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold">Emergency contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="Contact person">
            <input name="emergency_contact_name" defaultValue={v.emergency_contact_name} className={input} />
          </Field>
          <Field name="Relationship">
            <input name="emergency_contact_relationship" defaultValue={v.emergency_contact_relationship} className={input} />
          </Field>
          <Field name="Contact number">
            <input name="emergency_contact_number" type="tel" defaultValue={v.emergency_contact_number} className={input} />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {msg && <span className={msg === "Saved." ? "text-sm text-success" : "text-sm text-danger"}>{msg}</span>}
      </div>
    </form>
  );
}
