"use client";

import { useActionState } from "react";
import type { Workspace } from "@/lib/database.types";
import { Field, inputClass, primaryButton } from "@/components/analytics/ui";
import { saveBranding, type SettingsState } from "./actions";

export function BrandingForm({ workspace, logo }: { workspace: Workspace; logo: string | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveBranding, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input name="name" defaultValue={workspace.name} required maxLength={80} className={inputClass} />
        </Field>
        <Field label="Workspace type">
          <select name="kind" defaultValue={workspace.kind} className={inputClass}>
            <option value="host">I host my own units</option>
            <option value="manager">I manage units for owners</option>
          </select>
        </Field>
        <Field label="Display name" hint="Shown in the sidebar and on owner statements.">
          <input name="brand_name" defaultValue={workspace.brand_name ?? ""} maxLength={80} className={inputClass} />
        </Field>
        <Field label="Brand colour" hint="Statement header accent.">
          <input
            type="color"
            name="brand_color"
            defaultValue={workspace.brand_color ?? "#1d4ed8"}
            className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-background p-1"
          />
        </Field>
      </div>
      <Field label="Logo" hint="PNG, JPG, WebP or SVG up to 2 MB. A wide logo on a transparent background works best.">
        <div className="flex items-center gap-4">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Current logo" className="h-12 max-w-[140px] rounded bg-white object-contain p-1" />
          )}
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-foreground"
          />
        </div>
      </Field>
      {logo && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="remove_logo" /> Remove logo
        </label>
      )}
      <Field label="Statement footer" hint="Bank details, contact number, terms — printed at the bottom of every owner statement.">
        <textarea name="statement_footer" rows={3} defaultValue={workspace.statement_footer ?? ""} className={inputClass} />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && <p className="text-sm text-success">{state.message}</p>}
      <div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
