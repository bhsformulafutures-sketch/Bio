import { getStore } from "../store";
import type { NotificationEvent } from "./events";
import { pushIsConfigured, sendWebPush } from "./push";

/**
 * The single delivery seam for notifications: resolve the room's recipients,
 * look up each one's browser push subscriptions, and fan the event out to them.
 *
 * Push stays dormant until VAPID keys are configured (see ./push.ts) — with no
 * keys this just logs in dev, so producers are correct and testable without any
 * setup. A notification must never break the action that produced it, so this
 * always resolves and never throws.
 */
export async function dispatch(event: NotificationEvent): Promise<void> {
  try {
    const store = getStore();
    const participants = await store.getRoomParticipants(event.roomId);
    const recipients = participants.filter((p) => p.id !== event.exceptParticipantId);
    if (recipients.length === 0) return;

    if (!pushIsConfigured()) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `🔔 [${event.type}] → ${recipients.length} recipient(s) (push not configured): ` +
            `${event.title} — ${event.body}`
        );
      }
      return;
    }

    await Promise.all(
      recipients.map(async (p) => {
        const subs = await store.listPushSubscriptions(p.id);
        await Promise.all(
          subs.map(async (sub) => {
            const result = await sendWebPush(sub, event);
            // Prune dead endpoints so we don't keep retrying them.
            if (result === "gone") await store.deletePushSubscription(sub.endpoint);
          })
        );
      })
    );
  } catch (error) {
    console.error("notification dispatch failed:", error);
  }
}
