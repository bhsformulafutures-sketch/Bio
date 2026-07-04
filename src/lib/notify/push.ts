import webpush from "web-push";
import type { PushSubscriptionRecord } from "../store/types";
import type { NotificationEvent } from "./events";

/**
 * Browser push delivery via VAPID. Configured entirely from the environment so
 * the app runs with zero setup (push simply stays off until keys exist):
 *
 *   VAPID_PUBLIC_KEY   — also served to the client for PushManager.subscribe
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT      — a mailto: or https: contact URL (optional)
 *
 * Generate a keypair once with:  npx web-push generate-vapid-keys
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured === null) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    configured = Boolean(pub && priv);
    if (configured) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:hello@theotherhalf.app",
        pub!,
        priv!
      );
    }
  }
  return configured;
}

/** Whether push is wired up (controls the client's enable affordance). */
export function pushIsConfigured(): boolean {
  return ensureConfigured();
}

/** The public key the browser needs to create a subscription. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Deliver one event to one subscription. Resolves to "gone" when the endpoint
 * is dead (404/410) so the caller can prune it; "sent" on success; "error"
 * otherwise — a notification must never throw into the triggering request.
 */
export async function sendWebPush(
  sub: PushSubscriptionRecord,
  event: NotificationEvent
): Promise<"sent" | "gone" | "error"> {
  if (!ensureConfigured()) return "error";
  const payload = JSON.stringify({
    title: event.title,
    body: event.body,
    url: event.url,
    type: event.type,
  });
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("web-push send failed:", error);
    return "error";
  }
}
