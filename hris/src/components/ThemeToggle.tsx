"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { applyTheme, getThemeMode, setThemeMode, subscribeTheme, type ThemeMode } from "@/lib/theme";

const options: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "system", label: "Match my device", Icon: Monitor },
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode, (): ThemeMode => "system");

  // While following the device, switch when the device switches (e.g. at sunset).
  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn("inline-flex rounded-lg border border-border bg-surface-raised p-0.5", className)}
    >
      {options.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={mode === m}
          onClick={() => setThemeMode(m)}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            mode === m ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
