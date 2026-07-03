import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";
import { CODE_TTL_MS, RESEND_COOLDOWN_MS, generateCode, hashCode } from "@/lib/auth/otp";
import { getEmailProvider, emailIsLive } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/request-code { email }
 * Send a one-time verification code by email. In zero-config dev (no email
 * provider) the code is returned in the response so the flow is testable.
 */
export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = await request.json();
    email = normalizeEmail(String(body?.email ?? ""));
  } catch {
    /* fall through to validation */
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "That doesn't look like an email address." },
      { status: 400 }
    );
  }

  try {
    const store = getStore();

    // Gentle rate limit: one code per address per cooldown window.
    const existing = await store.getVerification(email);
    if (existing) {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < RESEND_COOLDOWN_MS) {
        return NextResponse.json(
          { error: "Hang on a moment before asking for another code." },
          { status: 429 }
        );
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
    await store.upsertVerification(email, hashCode(email, code), expiresAt);

    await getEmailProvider().send(
      email,
      "Your verification code",
      `Your The Other Half code is ${code}. It expires in 10 minutes.`
    );

    return NextResponse.json({
      ok: true,
      // Only ever exposed when real email isn't configured (local/dev).
      devCode: emailIsLive() ? undefined : code,
    });
  } catch (error) {
    console.error("request-code failed:", error);
    return NextResponse.json(
      { error: "Couldn't send a code. Please try again." },
      { status: 500 }
    );
  }
}
