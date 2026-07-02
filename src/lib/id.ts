import { randomBytes } from "crypto";

/** No ambiguous characters (0/O, 1/I/L) — codes get read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newRoomCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}
