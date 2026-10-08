"use client";

import { useActionState } from "react";
import { createRun } from "./actions";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

const options: [string, string, string][] = [
  ["deduct_absences", "Deduct absences", "Unpaid days at the daily rate (monthly rate × 12 ÷ working days a year)."],
  ["deduct_late", "Deduct late and undertime", "By the minute, from the employee's clock-ins."],
  ["gov_contributions", "Compute SSS, PhilHealth and Pag-IBIG", "Employee share deducted; employer share recorded as a cost."],
  ["withhold_tax", "Withhold income tax", "Annualized on pay after contributions, using the TRAIN table."],
  [
    "holiday_pay",
    "Holiday pay",
    "From the Company Calendar. Regular holiday: worked 200%, not worked 100% (if present the day before). Special non-working day: worked 130%, not worked no pay. On a rest day: 260% regular, 150% special.",
  ],
  [
    "overtime_pay",
    "Overtime pay",
    "Approved overtime requests only. Ordinary day 125% of the hourly rate; rest day or special day 169%; special day on rest day 195%; regular holiday 260% (338% on the rest day).",
  ],
];

export function NewRunForm({ start, end }: { start: string; end: string }) {
  const [error, action, pending] = useActionState(createRun, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm text-muted">Period start *</label>
        <input name="period_start" type="date" required defaultValue={start} className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Period end *</label>
        <input name="period_end" type="date" required defaultValue={end} className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Pay date *</label>
        <input name="pay_date" type="date" required defaultValue={end} className={input} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">Pay periods per month</label>
        <select name="periods_per_month" defaultValue="2" className={input}>
          <option value="2">2 (semi-monthly)</option>
          <option value="1">1 (monthly)</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm text-muted">Label (optional)</label>
        <input name="label" placeholder="e.g. October 1st half" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm text-muted">Field allowance per field day (optional)</label>
        <input name="field_allowance" type="number" min="0" step="0.01" placeholder="e.g. 250, or leave blank for none" className={input} />
        <p className="mt-1 text-xs text-muted">
          Days timed in as Field / out of office are always paid as normal attendance. If you give a daily allowance for
          them, enter the amount in pesos and it is added to each person&apos;s pay for every field day in the period.
        </p>
      </div>
      <fieldset className="flex flex-col gap-3 sm:col-span-2">
        <legend className="mb-1 text-sm text-muted">Include</legend>
        {options.map(([name, title, hint]) => (
          <label key={name} className="flex items-start gap-3 text-sm">
            <input type="checkbox" name={name} defaultChecked className="mt-1" />
            <span>{title}<span className="block text-xs text-muted">{hint}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="sm:col-span-2">
        <button disabled={pending} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
          {pending ? "Calculating…" : "Create draft run"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">
          This creates a draft you can review and adjust. Nothing is final until you finalize it.
        </p>
      </div>
    </form>
  );
}
