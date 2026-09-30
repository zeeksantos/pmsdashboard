import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const me = await getCurrentUser();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">
        Hello, {me?.employee?.full_name ?? me?.email}
      </h1>

      {!me?.employee ? (
        <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Your login isn&apos;t linked to an employee record yet, so you can&apos;t time in.
          Ask an admin or HR to link it.
        </div>
      ) : (
        <Link
          href="/time-clock"
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          Go to Time Clock
        </Link>
      )}
    </div>
  );
}
