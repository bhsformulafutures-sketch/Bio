import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";
import { MAX_ATTEMPTS, verifyCode } from "@/lib/auth/otp";
import { setAuthCookie } from "@/lib/session";
import { userToDTO } from "@/lib/serialize";
import type { AuthStateDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify { email, code }
 * Check the code, then sign the person in — creating their account on first
 * use. New accounts come back with `needsProfile: true` so the client can
 * collect a name before they reach a room.
 */
export async function POST(request: NextRequest) {
  let email = "";
  let code = "";
  try {
    const body = await request.json();
    email = normalizeEmail(String(body?.email ?? ""));
    code = String(body?.code ?? "").replace(/\D/g, "");
  } catch {
    /* fall through to validation */
  }
  if (!isValidEmail(email) || code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code we sent you." }, { status: 400 });
  }

  try {
    const store = getStore();
    const verification = await store.getVerification(email);
    if (!verification) {
      return NextResponse.json(
        { error: "That code has expired. Ask for a new one." },
        { status: 400 }
      );
    }
    if (verification.attempts >= MAX_ATTEMPTS) {
      await store.deleteVerification(email);
      return NextResponse.json(
        { error: "Too many tries. Ask for a new code." },
        { status: 429 }
      );
    }
    if (new Date(verification.expiresAt).getTime() < Date.now()) {
      await store.deleteVerification(email);
      return NextResponse.json(
        { error: "That code has expired. Ask for a new one." },
        { status: 400 }
      );
    }
    if (!verifyCode(email, code, verification.codeHash)) {
      await store.incrementVerificationAttempts(email);
      return NextResponse.json(
        { error: "That code isn't right. Try again." },
        { status: 400 }
      );
    }

    // Correct code — burn it and sign the person in.
    await store.deleteVerification(email);
    let user = await store.getUserByEmail(email);
    if (!user) user = await store.createUser(email, "", null);

    const memberships = await store.listMemberships(user.id);
    const state: AuthStateDTO = {
      authenticated: true,
      user: userToDTO(user),
      hasRoom: memberships.length > 0,
      needsProfile: user.name.trim().length === 0,
    };

    const response = NextResponse.json(state);
    setAuthCookie(response, user.token);
    return response;
  } catch (error) {
    console.error("verify failed:", error);
    return NextResponse.json({ error: "Couldn't verify that code. Try again." }, { status: 500 });
  }
}
