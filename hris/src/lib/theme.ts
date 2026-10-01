// Light / dark / follow-the-device theme. The choice lives in localStorage ("theme"); the
// resolved result is written to <html data-theme="light|dark"> and picked up by globals.css.

export type ThemeMode = "system" | "light" | "dark";
export const THEME_KEY = "theme";

const MODES: ThemeMode[] = ["system", "light", "dark"];

function prefersLight(): boolean {
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return prefersLight() ? "light" : "dark";
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode);
}

export function getThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return MODES.includes(stored as ThemeMode) ? (stored as ThemeMode) : "system";
  } catch {
    return "system"; // storage blocked (private window etc.)
  }
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // The choice still applies for this visit; it just won't be remembered.
  }
  applyTheme(mode);
  window.dispatchEvent(new Event("themechange"));
}

export function subscribeTheme(onChange: () => void) {
  window.addEventListener("storage", onChange); // another tab changed it
  window.addEventListener("themechange", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

// Runs in <head> before the page paints, so there is no flash of the wrong theme.
// Must stay in sync with resolveTheme above.
export const themeInitScript = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");if(m!=="light"&&m!=="dark")m="system";var l=m==="light"||(m==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=l?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;
