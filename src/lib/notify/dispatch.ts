import { getStore } from "../store";
import type { NotificationEvent } from "./events";

/**
 * The single delivery seam for notifications.
 *
 * Phase 5 (browser push) plugs in here: resolve the room's push subscriptions
 * for every recipient and POST the payload to each endpoint with web-push.
 * Until VAPID keys + subscriptions are wired, this logs the event so producers
 * are already correct and testable end to end.
 *
 * A notification must never break the user action that produced it, so this
 * always resolves and never throws.
 */
export async function dispatch(event: NotificationEvent): Promise<void> {
  try {
    const participants = await getStore().getRoomParticipants(event.roomId);
    const recipients = participants.filter(
      (p) => p.id !== event.exceptParticipantId
    );
    if (recipients.length === 0) return;

    // ── Integration point ──────────────────────────────────────────────
    // for (const p of recipients) {
    //   const subs = await getStore().listPushSubscriptions(p.id);
    //   await Promise.all(subs.map((s) => sendWebPush(s, event)));
    // }
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `🔔 [${event.type}] → ${recipients.length} recipient(s): ${event.title} — ${event.body}`
      );
    }
  } catch (error) {
    console.error("notification dispatch failed:", error);
  }
}
