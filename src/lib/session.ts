import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStore } from "./store";
import type { SessionRecord, UserRecord } from "./store/types";

/** The signed-in person (a global account keyed by email). */
export const AUTH_COOKIE = "oh_uid";
/** Which room the browser is currently looking at. */
export const ROOM_COOKIE = "oh_room";
const ONE_YEAR = 60 * 60 * 24 * 365;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: ONE_YEAR,
  path: "/",
} as const;

/** Resolve the signed-in user from the auth cookie (no room needed). */
export async function getUser(): Promise<UserRecord | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    return await getStore().getUserByToken(token);
  } catch {
    return null;
  }
}

/**
 * Resolve the full session: the user plus their active room and partner.
 * Returns null when the person isn't signed in or isn't in any room yet.
 */
export async function getSession(): Promise<SessionRecord | null> {
  const user = await getUser();
  if (!user) return null;
  const store = getStore();

  try {
    const memberships = await store.listMemberships(user.id);
    if (memberships.length === 0) return null;

    const jar = await cookies();
    const activeRoomId = jar.get(ROOM_COOKIE)?.value;
    const membership =
      memberships.find((m) => m.roomId === activeRoomId) ?? memberships[0];

    const room = await store.getRoom(membership.roomId);
    if (!room) return null;

    const participants = await store.getRoomParticipants(room.id);
    const partner = participants.find((p) => p.id !== membership.id) ?? null;

    return { user, participant: membership, room, partner };
  } catch {
    return null;
  }
}

/** Sign a user in on this browser. */
export function setAuthCookie(response: NextResponse, userToken: string): void {
  response.cookies.set(AUTH_COOKIE, userToken, COOKIE_OPTIONS);
}

/** Point the browser at a specific room. */
export function setActiveRoom(response: NextResponse, roomId: string): void {
  response.cookies.set(ROOM_COOKIE, roomId, COOKIE_OPTIONS);
}

/** Sign out completely. */
export function clearSession(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(ROOM_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}
