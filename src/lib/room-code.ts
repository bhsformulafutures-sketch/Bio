/**
 * Room codes are the heart of pairing: a couple picks a word or phrase that
 * means something to them (SUNFLOWERS, OURPLACE, LATECALLS…) and the other
 * person types it to join. They're case-insensitive and stored normalized so
 * "OurPlace" and "ourplace" always land in the same room.
 */

export const ROOM_CODE_MIN = 4;
export const ROOM_CODE_MAX = 20;

/** Uppercase, trim, and drop spaces so a code is one canonical string. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/** Letters and digits only, 4–20 chars — easy to say out loud and type. */
export function isValidRoomCode(normalized: string): boolean {
  return (
    normalized.length >= ROOM_CODE_MIN &&
    normalized.length <= ROOM_CODE_MAX &&
    /^[A-Z0-9]+$/.test(normalized)
  );
}

/** Human-friendly reason a code was rejected, or null when it's fine. */
export function roomCodeError(normalized: string): string | null {
  if (normalized.length < ROOM_CODE_MIN) return `Use at least ${ROOM_CODE_MIN} characters.`;
  if (normalized.length > ROOM_CODE_MAX) return `Keep it under ${ROOM_CODE_MAX} characters.`;
  if (!/^[A-Z0-9]+$/.test(normalized)) return "Letters and numbers only.";
  return null;
}

/** A few warm suggestions to seed the imagination on the create screen. */
export const CODE_SUGGESTIONS = [
  "SUNFLOWERS",
  "OURPLACE",
  "LATECALLS",
  "HONEYBEE",
  "MOONBEAM",
  "TWOHEARTS",
];
