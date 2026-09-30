"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground print:hidden"
    >
      Print
    </button>
  );
}
