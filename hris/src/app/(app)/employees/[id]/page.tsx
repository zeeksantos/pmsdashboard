import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { canManageRecords, canViewSalaries } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { formatClock, label, weekdays } from "@/lib/employees";

type Emp = {
  id: string;
  employee_no: string;
  full_name: string;
  nickname: string | null;
  work_email: string | null;
  employment_type: string;
  status: string;
  date_hired: string;
  regularization_date: string | null;
  contract_end_date: string | null;
  user_id: string | null;
  departments: { name: string } | null;
  positions: { title: string } | null;
  manager: { id: string; full_name: string } | null;
};

function Item({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{name}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

const date = (d: string | null) => (d ? formatDate(d) : null);

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("employees")
    .select(
      "id, employee_no, full_name, nickname, work_email, employment_type, status, date_hired, regularization_date, contract_end_date, user_id, departments(name), positions(title), manager:employees!reports_to(id, full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const e = data as unknown as Emp;

  // RLS returns biodata only to HR/admin/owner and the employee themself.
  const [{ data: bio }, { data: sched }] = await Promise.all([
    supabase.from("employee_biodata").select("*").eq("employee_id", id).maybeSingle(),
    supabase
      .from("work_schedules")
      .select("days_of_week, start_time, end_time")
      .eq("employee_id", id)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const days = sched
    ? weekdays.filter((d) => sched.days_of_week.includes(d.value)).map((d) => d.label).join(", ")
    : null;
  const canEdit = me ? canManageRecords(me.role) : false;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{e.full_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {e.employee_no} · {e.positions?.title ?? "No position"} · {e.departments?.name ?? "No department"}
          </p>
        </div>
        <div className="flex gap-2">
        {me && canViewSalaries(me.role) && (
          <Link
            href={`/salaries/${e.id}`}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            Salary
          </Link>
        )}
        {canEdit && (
          <Link
            href={`/employees/${e.id}/edit`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            Edit
          </Link>
        )}
        </div>
      </div>

      <Card title="Work information">
        <Item name="Nickname" value={e.nickname} />
        <Item name="Work email" value={e.work_email} />
        <Item name="Employment type" value={label(e.employment_type)} />
        <Item name="Status" value={label(e.status)} />
        <Item name="Date hired" value={date(e.date_hired)} />
        <Item name="Regularization date" value={date(e.regularization_date)} />
        {e.employment_type === "CONTRACTUAL" && (
          <Item name="Contract end date" value={date(e.contract_end_date)} />
        )}
        <Item
          name="Reports to"
          value={e.manager && <Link href={`/employees/${e.manager.id}`} className="text-accent hover:underline">{e.manager.full_name}</Link>}
        />
        <Item name="Login" value={e.user_id ? "Linked" : "Not linked"} />
      </Card>

      <Card title="Work schedule">
        <Item name="Hours" value={sched ? `${formatClock(sched.start_time)} – ${formatClock(sched.end_time)}` : null} />
        <Item name="Days" value={days} />
      </Card>

      {bio ? (
        <>
          <Card title="Personal information">
            <Item name="Date of birth" value={date(bio.date_of_birth)} />
            <Item name="Place of birth" value={bio.place_of_birth} />
            <Item name="Gender" value={bio.gender && label(bio.gender)} />
            <Item name="Marital status" value={bio.civil_status && label(bio.civil_status)} />
            <Item name="Nationality" value={bio.nationality} />
            <Item name="Phone" value={bio.phone} />
            <Item name="Personal email" value={bio.personal_email} />
          </Card>
          <Card title="Address">
            <Item name="Present address" value={bio.present_address} />
            <Item name="City" value={bio.city} />
            <Item name="Province" value={bio.province} />
          </Card>
          <Card title="Emergency contact">
            <Item name="Contact person" value={bio.emergency_contact_name} />
            <Item name="Relationship" value={bio.emergency_contact_relationship} />
            <Item name="Contact number" value={bio.emergency_contact_number} />
          </Card>
          <Card title="Government numbers">
            <Item name="SSS no." value={bio.sss_no} />
            <Item name="PhilHealth no." value={bio.philhealth_no} />
            <Item name="Pag-IBIG no." value={bio.pagibig_no} />
            <Item name="TIN" value={bio.tin} />
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted">
          Biodata is only visible to HR, admin, owner, and the employee themself.
        </p>
      )}
    </div>
  );
}
