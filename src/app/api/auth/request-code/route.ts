import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { CODE_TTL_MS, RESEND_COOLDOWN_MS, generateCode, hashCode } from "@/lib/auth/otp";
import { getSmsProvider, smsIsLive } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/request-code { phone }
 * Send a one-time verification code by SMS. In zero-config dev (no SMS
 * provider) the code is returned in the response so the flow is testable.
 */
export async function POST(request: NextRequest) {
  let phone = "";
  try {
    const body = await request.json();
    phone = normalizePhone(String(body?.phone ?? ""));
  } catch {
    /* fall through to validation */
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: "That doesn't look like a phone number. Include your country code." },
      { status: 400 }
    );
  }

  try {
    const store = getStore();

    // Gentle rate limit: one code per number per cooldown window.
    const existing = await store.getVerification(phone);
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
    await store.upsertVerification(phone, hashCode(phone, code), expiresAt);

    await getSmsProvider().send(
      phone,
      `Two of Us: your code is ${code}. It expires in 10 minutes.`
    );

    return NextResponse.json({
      ok: true,
      // Only ever exposed when real SMS isn't configured (local/dev).
      devCode: smsIsLive() ? undefined : code,
    });
  } catch (error) {
    console.error("request-code failed:", error);
    return NextResponse.json(
      { error: "Couldn't send a code. Please try again." },
      { status: 500 }
    );
  }
}
