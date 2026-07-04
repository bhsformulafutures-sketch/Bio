import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { pushIsConfigured, vapidPublicKey } from "@/lib/notify/push";

export const dynamic = "force-dynamic";

/** GET /api/push — is push configured, and the VAPID public key to subscribe. */
export async function GET() {
  return NextResponse.json({
    configured: pushIsConfigured(),
    publicKey: vapidPublicKey(),
  });
}

/** POST /api/push { subscription } — register this browser for notifications. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    const body = (await request.json()) as { subscription?: typeof sub };
    sub = body.subscription ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const endpoint = sub.endpoint;
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Incomplete subscription." }, { status: 400 });
  }

  try {
    await getStore().savePushSubscription(session.participant.id, { endpoint, p256dh, auth });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("savePushSubscription failed:", error);
    return NextResponse.json({ error: "Couldn't enable notifications." }, { status: 500 });
  }
}

/** DELETE /api/push { endpoint } — turn notifications off for this browser. */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  let endpoint = "";
  try {
    endpoint = String(((await request.json()) as { endpoint?: string }).endpoint ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: "No endpoint." }, { status: 400 });

  try {
    await getStore().deletePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("deletePushSubscription failed:", error);
    return NextResponse.json({ error: "Couldn't update notifications." }, { status: 500 });
  }
}
