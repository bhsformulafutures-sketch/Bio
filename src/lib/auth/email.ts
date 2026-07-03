/**
 * Email address handling. We store addresses in a normalized lowercase,
 * trimmed form so the same address always maps to the same account and
 * the same notification target.
 */

/** Trim and lowercase so "Jo@Example.com " and "jo@example.com" match. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Loose validity check — enough to reject typos, not to police the world. */
export function isValidEmail(normalized: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

/** A privacy-preserving hint shown back to the user: "j***@gmail.com". */
export function emailHint(normalized: string): string {
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return "•••";
  const maskedLocal = local.length <= 1 ? `${local}*` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}
