import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStore } from "./store";
import type { SessionRecord } from "./store/types";

/** Active membership token — the room the browser is currently "in". */
export const SESSION_COOKIE = "oh_token";
/** Every membership token this browser holds, comma-separated. */
export const TOKENS_COOKIE = "oh_tokens";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Resolve the current participant from the httpOnly session cookie. */
export async function getSession(): Promise<SessionRecord | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await getStore().getSessionByToken(token);
  } catch {
    return null;
  }
}

/** All membership tokens in this browser, active one first. */
export async function getAllTokens(): Promise<string[]> {
  const jar = await cookies();
  const active = jar.get(SESSION_COOKIE)?.value;
  const rest = (jar.get(TOKENS_COOKIE)?.value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const ordered = active ? [active, ...rest] : rest;
  return [...new Set(ordered)];
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: ONE_YEAR,
  path: "/",
} as const;

/** Persist the full membership list plus which room is active. */
export function writeSessionCookies(
  response: NextResponse,
  tokens: string[],
  activeToken: string | null
): void {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (activeToken) response.cookies.set(SESSION_COOKIE, activeToken, COOKIE_OPTIONS);
  else response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  if (unique.length > 0)
    response.cookies.set(TOKENS_COOKIE, unique.join(","), COOKIE_OPTIONS);
  else response.cookies.set(TOKENS_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** Add one membership and make it active (create room / join room). */
export async function attachSession(
  response: NextResponse,
  token: string
): Promise<void> {
  const tokens = await getAllTokens();
  writeSessionCookies(response, [token, ...tokens], token);
}
