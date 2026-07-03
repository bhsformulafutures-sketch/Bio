import { getStore } from "../store";
import { getEmailProvider } from "./index";
import type { ParticipantRecord } from "../store/types";

/** Resolve a participant's email (via their user account), if any. */
async function emailOf(participant: ParticipantRecord | null): Promise<string | null> {
  if (!participant?.userId) return null;
  const user = await getStore().getUserById(participant.userId);
  return user?.email ?? null;
}

/** The two members of a room, or fewer if the second hasn't joined. */
async function membersOf(roomId: string): Promise<ParticipantRecord[]> {
  return getStore().getRoomParticipants(roomId);
}

/** Send one email, swallowing failures — a notification must never break the
 *  user action that triggered it. */
async function sendSafely(email: string | null, subject: string, body: string): Promise<void> {
  if (!email) return;
  try {
    await getEmailProvider().send(email, subject, body);
  } catch (error) {
    console.error("notification send failed:", error);
  }
}

/** Notify the partner that a new Other Half challenge is waiting. */
export async function notifyChallengeSent(
  roomId: string,
  fromParticipantId: string,
  fromName: string
): Promise<void> {
  const members = await membersOf(roomId);
  const partner = members.find((p) => p.id !== fromParticipantId) ?? null;
  await sendSafely(
    await emailOf(partner),
    "New Other Half waiting 🎨",
    `${fromName} sent you a new Other Half — imagine the missing piece.`
  );
}

/** Notify the creator that the partner finished their challenge. */
export async function notifyChallengeCompleted(
  roomId: string,
  creatorParticipantId: string,
  solverName: string
): Promise<void> {
  const members = await membersOf(roomId);
  const creator = members.find((p) => p.id === creatorParticipantId) ?? null;
  await sendSafely(
    await emailOf(creator),
    "Your reveal is ready ✨",
    `${solverName} answered your challenge — go see the reveal.`
  );
}

/** Notify the partner that a Random Challenge just started (24h clock ticking). */
export async function notifyRandomStarted(
  roomId: string,
  fromParticipantId: string,
  fromName: string,
  prompt: string
): Promise<void> {
  const members = await membersOf(roomId);
  const partner = members.find((p) => p.id !== fromParticipantId) ?? null;
  await sendSafely(
    await emailOf(partner),
    "A Random Challenge just started 📸",
    `${fromName} started a Random Challenge — "${prompt}". You have 24 hours.`
  );
}

/** Notify both people that a Random Challenge is complete and ready to reveal. */
export async function notifyRandomCompleted(roomId: string): Promise<void> {
  const members = await membersOf(roomId);
  await Promise.all(
    members.map(async (p) =>
      sendSafely(
        await emailOf(p),
        "Your Random Challenge is ready 💞",
        "You both answered — your Random Challenge is ready to reveal."
      )
    )
  );
}

/**
 * Notify both people that today's Random Challenge is available. Intended to
 * be called from a scheduled job (e.g. a daily cron hitting an API route);
 * kept here so the delivery logic lives in one place.
 */
export async function notifyDailyAvailable(roomId: string, prompt: string): Promise<void> {
  const members = await membersOf(roomId);
  await Promise.all(
    members.map(async (p) =>
      sendSafely(
        await emailOf(p),
        "Today's Random Challenge 🌅",
        `Today's Random Challenge is here — "${prompt}".`
      )
    )
  );
}
