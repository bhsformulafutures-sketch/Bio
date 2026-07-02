import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — sign out of this browser. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSession(response);
  return response;
}
