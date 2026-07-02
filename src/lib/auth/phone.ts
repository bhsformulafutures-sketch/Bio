/**
 * Phone number handling. We store numbers in a normalized E.164-ish form
 * (a leading "+" followed by digits) so the same phone always maps to the
 * same account and the same notification target.
 */

/** Strip formatting; keep a leading + and digits only. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  // A bare 10-digit number is assumed to be North American (+1) so the
  // common case "Just type your number" works without a country picker.
  if (!hasPlus && digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/** Loose validity check — enough to reject typos, not to police the world. */
export function isValidPhone(normalized: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

/** A privacy-preserving hint shown back to the user: "•••• 4821". */
export function phoneHint(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}
