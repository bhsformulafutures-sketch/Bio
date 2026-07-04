import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser, setAuthCookie } from "@/lib/session";
import { userToDTO } from "@/lib/serialize";
import { AVATARS, MAX_NICKNAME } from "@/lib/avatars";
import type { AuthStateDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/account — the emoji avatars to choose from. */
export async function GET() {
  return NextResponse.json({ avatars: AVATARS });
}

/**
 * POST /api/account { name, avatar }
 * The whole sign-in: pick a nickname and an avatar. With no existing session
 * this mints a fresh device identity and signs the browser in; if already
 * signed in, it updates the profile. No email, no codes.
 */
export async function POST(request: NextRequest) {
  let name = "";
  let avatar: string | null = null;
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim().slice(0, MAX_NICKNAME);
    const raw = body?.avatar;
    avatar = typeof raw === "string" && AVATARS.includes(raw) ? raw : null;
  } catch {
    /* fall through to validation */
  }
  if (!name) {
    return NextResponse.json({ error: "What should we call you?" }, { status: 400 });
  }

  try {
    const store = getStore();
    const existing = await getUser();

    if (existing) {
      // Signed in already — just update the profile.
      const updated = await store.updateUser(existing.id, { name, avatar });
      const memberships = await store.listMemberships(updated.id);
      const state: AuthStateDTO = {
        authenticated: true,
        user: userToDTO(updated),
        hasRoom: memberships.length > 0,
        needsProfile: false,
      };
      return NextResponse.json(state);
    }

    const user = await store.createUser(name, avatar);
    const state: AuthStateDTO = {
      authenticated: true,
      user: userToDTO(user),
      hasRoom: false,
      needsProfile: false,
    };
    const response = NextResponse.json(state, { status: 201 });
    setAuthCookie(response, user.token);
    return response;
  } catch (error) {
    console.error("account create/update failed:", error);
    return NextResponse.json({ error: "Couldn't save your profile. Try again." }, { status: 500 });
  }
}
