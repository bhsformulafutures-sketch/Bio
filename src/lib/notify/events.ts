/**
 * The notification vocabulary. These are the moments worth a nudge — kept as a
 * typed union so every producer and (future) delivery channel agrees on shape.
 *
 * Delivery is intentionally decoupled: `dispatch` in ./dispatch.ts is the one
 * integration point. Today it logs; wiring it to browser push (see
 * ./push.ts + the service worker) lights all of these up without touching
 * any calling code.
 */

export type NotificationType =
  | "challenge_received" // partner sent you a new Other Half / started a Random
  | "challenge_completed" // partner finished your challenge — reveal ready
  | "daily_available" // today's Random Challenge is live
  | "deadline_reminder"; // a live challenge's clock is running low

export interface NotificationEvent {
  type: NotificationType;
  /** Room the event belongs to — recipients are its members. */
  roomId: string;
  /** Participant who should NOT be notified (usually the actor), if any. */
  exceptParticipantId?: string;
  title: string;
  body: string;
  /** Where a tap should land (client route). */
  url: string;
}
