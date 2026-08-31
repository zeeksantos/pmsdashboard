import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GuestFormDialog } from "./GuestFormDialog";
import { DeleteGuestButton } from "./DeleteGuestButton";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const supabase = await createClient();
  let request = supabase.from("guests").select("*").order("full_name", { ascending: true });

  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    request = request.or(
      `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%,id_number.ilike.%${escaped}%`
    );
  }

  const { data: guests, error } = await request;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Guests</h1>
          <p className="mt-1 text-sm text-muted">
            Centralized guest directory — stay history and spending appear on each guest&apos;s
            profile once bookings exist.
          </p>
        </div>
        <GuestFormDialog />
      </div>

      <form action="/guests" method="get" className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by name, phone, email, or ID…"
          className="w-full rounded-lg border border-border bg-surface-raised py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent"
        />
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load guests: {error.message}
        </div>
      )}

      {!error && guests && guests.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          {query ? `No guests match "${query}".` : "No guests yet. Add your first guest to get started."}
        </div>
      )}

      {!error && guests && guests.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/guests/${guest.id}`} className="hover:text-accent hover:underline">
                      {guest.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{guest.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{guest.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {guest.id_type ? `${guest.id_type} · ${guest.id_number ?? "—"}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <GuestFormDialog guest={guest} />
                      <DeleteGuestButton guestId={guest.id} guestName={guest.full_name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
