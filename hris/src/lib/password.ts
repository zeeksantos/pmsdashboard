export const MIN_PASSWORD_LENGTH = 8;

// Returns an error message, or null when the new password is acceptable.
export function validateNewPassword(password: string, confirm: string, current?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return "The new passwords don't match.";
  if (current !== undefined && password === current) {
    return "Choose a password different from the current one.";
  }
  return null;
}

// One-time codes from Supabase are digits only (6 by default, up to 10).
export function normalizeCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, "");
  return /^\d{6,10}$/.test(code) ? code : null;
}
