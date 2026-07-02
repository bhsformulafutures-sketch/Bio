import { getStore } from "../store";
import { getSmsProvider } from "./index";
import type { ParticipantRecord } from "../store/types";

const APP_NAME = "Two of Us";

/** Resolve a participant's phone (via their user account), if any. */
async function phoneOf(participant: ParticipantRecord | null): Promise<string | null> {
  if (!participant?.userId) return null;
  const user = await getStore().getUserById(participant.userId);
  return user?.phone ?? null;
}

/** The two members of a room, or fewer if the second hasn't joined. */
async function membersOf(roomId: string): Promise<ParticipantRecord[]> {
  return getStore().getRoomParticipants(roomId);
}

/** Send one SMS, swallowing failures — a notification must never break the
 *  user action that triggered it. */
async function sendSafely(phone: string | null, body: string): Promise<void> {
  if (!phone) return;
  try {
    await getSmsProvider().send(phone, body);
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
    await phoneOf(partner),
    `${APP_NAME}: ${fromName} sent you a new Other Half — imagine the missing piece 🎨`
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
    await phoneOf(creator),
    `${APP_NAME}: ${solverName} answered your challenge — go see the reveal ✨`
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
    await phoneOf(partner),
    `${APP_NAME}: ${fromName} started a Random Challenge — "${prompt}". You have 24 hours 📸`
  );
}

/** Notify both people that a Random Challenge is complete and ready to reveal. */
export async function notifyRandomCompleted(roomId: string): Promise<void> {
  const members = await membersOf(roomId);
  await Promise.all(
    members.map(async (p) =>
      sendSafely(await phoneOf(p), `${APP_NAME}: you both answered — your Random Challenge is ready 💞`)
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
        await phoneOf(p),
        `${APP_NAME}: today's Random Challenge is here — "${prompt}" 🌅`
      )
    )
  );
}
