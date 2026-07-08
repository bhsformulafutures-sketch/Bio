/**
 * Where Am I — fuzzy answer matching.
 *
 * Server-side only judgement so the secret never has to reach the guesser's
 * browser. Both sides are normalized (lowercase, diacritics stripped,
 * punctuation dropped, whitespace collapsed) and a guess counts when it
 * equals the answer or one contains the other — so "Trafalgar Square",
 * "trafalgar square!!" and "the trafalgar square fountain" all land, while
 * a lucky two-letter guess doesn't.
 *
 * Edge cases this must hold for (exercised manually during development):
 *   matchesAnswer("Trafalgar Square", "trafalgar square")  → true  (case)
 *   matchesAnswer("Café René", "cafe rene")                → true  (diacritics)
 *   matchesAnswer("the coffee shop on 5th", "coffee shop") → true  (containment)
 *   matchesAnswer("Rome", "rome!!!")                       → true  (punctuation)
 *   matchesAnswer("Rome", "ro")                            → false (too short to contain)
 *   matchesAnswer("home", "rome")                          → false (no substring either way)
 *   matchesAnswer("Pont  Neuf", " pont   neuf ")           → true  (whitespace collapse)
 *   matchesAnswer("NYC", "nyc")                            → true  (equality skips the length gate)
 *   matchesAnswer("somewhere", "")                         → false (empty guess)
 */

/** Shortest normalized string allowed to win by mere containment. */
const MIN_CONTAINMENT_LENGTH = 4;

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
export function normalizePlace(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks left by NFD
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // punctuation/symbols → spaces
    .replace(/\s+/g, " ")
    .trim();
}

/** Does this guess count as the answer? Exact match, or containment either
 *  way when the contained side is long enough to be meaningful. */
export function matchesAnswer(answer: string, guess: string): boolean {
  const a = normalizePlace(answer);
  const g = normalizePlace(guess);
  if (!a || !g) return false;
  if (a === g) return true;
  if (g.length >= MIN_CONTAINMENT_LENGTH && a.includes(g)) return true;
  if (a.length >= MIN_CONTAINMENT_LENGTH && g.includes(a)) return true;
  return false;
}
