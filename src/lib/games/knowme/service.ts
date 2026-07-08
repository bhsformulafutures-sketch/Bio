import { getStore } from "@/lib/store";
import type { KnowMeRoundRecord } from "@/lib/store/types";

/** How many past rounds' questions to avoid when drawing a new hand. */
const AVOID_LAST_ROUNDS = 3;

/** True when the room already has a live round (open or mid-reveal). */
export function hasLiveKnowMe(rounds: KnowMeRoundRecord[]): boolean {
  return rounds.some((r) => r.status === "open" || r.status === "answered");
}

/** Questions used in the room's most recent rounds — don't repeat them. */
export async function recentKnowMeQuestions(roomId: string): Promise<string[]> {
  const rounds = await getStore().listKnowMeRounds(roomId);
  return rounds.slice(0, AVOID_LAST_ROUNDS).flatMap((r) => r.questions);
}
