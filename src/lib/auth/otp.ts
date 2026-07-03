import { createHmac, randomInt, timingSafeEqual } from "crypto";

/** One-time codes live for ten minutes and tolerate five wrong guesses. */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
/** Don't let an identifier request a fresh code more than once every 30s. */
export const RESEND_COOLDOWN_MS = 30 * 1000;

/** A secret pepper so a leaked verifications table can't be brute-forced
 *  offline. Falls back to a constant in zero-config dev. */
const PEPPER = process.env.AUTH_SECRET ?? "two-of-us-dev-pepper";

/** Six-digit numeric code, uniformly random. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** HMAC the code with the identifier as salt so identical codes for
 *  different accounts hash differently. */
export function hashCode(identifier: string, code: string): string {
  return createHmac("sha256", PEPPER).update(`${identifier}:${code}`).digest("hex");
}

export function verifyCode(identifier: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCode(identifier, code));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
