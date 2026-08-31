"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function DetailsToggle({ details }: { details: unknown }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {isOpen ? "Hide" : "View"}
      </button>
      {isOpen && (
        <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-surface-raised p-3 text-xs text-muted">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
