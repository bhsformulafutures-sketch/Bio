import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser } from "@/lib/session";
import { userToDTO } from "@/lib/serialize";
import type { AuthStateDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/auth/state — where is this browser in the onboarding flow? */
export async function GET() {
  const user = await getUser();
  if (!user) {
    const state: AuthStateDTO = {
      authenticated: false,
      user: null,
      hasRoom: false,
      needsProfile: false,
    };
    return NextResponse.json(state);
  }

  const memberships = await getStore().listMemberships(user.id);
  const state: AuthStateDTO = {
    authenticated: true,
    user: userToDTO(user),
    hasRoom: memberships.length > 0,
    needsProfile: user.name.trim().length === 0,
  };
  return NextResponse.json(state);
}
