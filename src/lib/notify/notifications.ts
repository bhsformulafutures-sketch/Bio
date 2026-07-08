import { dispatch } from "./dispatch";

/**
 * High-level notification producers. Each builds a typed event and hands it to
 * the dispatcher; nothing here knows or cares how it's delivered. Signatures
 * are unchanged from the old email system so callers didn't have to move.
 */

/** Notify the partner that a new Other Half challenge is waiting. */
export async function notifyChallengeSent(
  roomId: string,
  fromParticipantId: string,
  fromName: string
): Promise<void> {
  await dispatch({
    type: "challenge_received",
    roomId,
    exceptParticipantId: fromParticipantId,
    title: "New Other Half 🎨",
    body: `${fromName} sent you one — imagine the missing piece.`,
    url: "/home",
  });
}

/** Notify the creator that the partner (the solver) finished their challenge. */
export async function notifyChallengeCompleted(
  roomId: string,
  solverParticipantId: string,
  solverName: string
): Promise<void> {
  await dispatch({
    type: "challenge_completed",
    roomId,
    // The solver already knows they just finished — notify the creator only.
    exceptParticipantId: solverParticipantId,
    title: "Your reveal is ready ✨",
    body: `${solverName} answered your challenge — go see it.`,
    url: "/home",
  });
}

/** Notify the partner that a Random Challenge just started (24h clock ticking). */
export async function notifyRandomStarted(
  roomId: string,
  fromParticipantId: string,
  fromName: string,
  prompt: string
): Promise<void> {
  await dispatch({
    type: "challenge_received",
    roomId,
    exceptParticipantId: fromParticipantId,
    title: "A Random Challenge 📸",
    body: `${fromName} started one — "${prompt}". You have 24 hours.`,
    url: "/home",
  });
}

/** Notify both people that a Random Challenge is complete and ready to reveal. */
export async function notifyRandomCompleted(roomId: string): Promise<void> {
  await dispatch({
    type: "challenge_completed",
    roomId,
    title: "Your Random Challenge is ready 💞",
    body: "You both answered — tap to reveal.",
    url: "/home",
  });
}

/**
 * Notify both people that today's Random Challenge is available. Intended for a
 * scheduled job (e.g. a daily cron hitting an API route).
 */
export async function notifyDailyAvailable(roomId: string, prompt: string): Promise<void> {
  await dispatch({
    type: "daily_available",
    roomId,
    title: "Today's Random Challenge 🌅",
    body: `Today's prompt is here — "${prompt}".`,
    url: "/home",
  });
}

/** Notify a room that a live challenge's deadline is approaching. */
export async function notifyDeadlineSoon(roomId: string, prompt: string): Promise<void> {
  await dispatch({
    type: "deadline_reminder",
    roomId,
    title: "Time's almost up ⏳",
    body: `Don't miss "${prompt}" — the clock's running down.`,
    url: "/home",
  });
}

// ── Game 3 · Know Me ─────────────────────────────────────────

/** Notify the partner that a Know Me round is waiting for their answers. */
export async function notifyKnowMeStarted(
  roomId: string,
  fromParticipantId: string,
  fromName: string
): Promise<void> {
  await dispatch({
    type: "challenge_received",
    roomId,
    exceptParticipantId: fromParticipantId,
    title: "How well do you know them? 💭",
    body: `${fromName} started a Know Me round — five questions await.`,
    url: "/knowme",
  });
}

/** Notify both people that a Know Me round is ready for its reveal. */
export async function notifyKnowMeAnswered(roomId: string): Promise<void> {
  await dispatch({
    type: "challenge_completed",
    roomId,
    title: "Your Know Me reveal is ready 💘",
    body: "You both answered — see the guesses side by side.",
    url: "/knowme",
  });
}
