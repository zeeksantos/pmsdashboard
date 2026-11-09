import Link from "next/link";

// Account pages (uploads, unit setup, expenses, owners, settings, admin)
// share the light analytics theme but not the dashboard's tab header.
export default function AnalyticsPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <Link href="/analytics" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      {children}
    </main>
  );
}
