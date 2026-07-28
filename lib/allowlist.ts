/**
 * An unset/empty ALLOWED_USER_EMAILS means the gate is off — everyone is
 * allowlisted. That's the default (single-operator deployment); the gate
 * only activates once the operator deliberately opens the app to others.
 */
export function isAllowlisted(email: string): boolean {
  const raw = process.env.ALLOWED_USER_EMAILS?.trim();
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
