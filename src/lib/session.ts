import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStore } from "./store";
import type { SessionRecord } from "./store/types";

export const SESSION_COOKIE = "oh_token";
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

export function attachSession(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
}
