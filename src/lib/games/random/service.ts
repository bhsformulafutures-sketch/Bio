import { getStore } from "@/lib/store";
import type { RandomRecord } from "@/lib/store/types";

/**
 * Reconcile a Random Challenge's status with the clock. An `open` challenge
 * whose 24 hours have elapsed is flipped to `expired` on read, so status is
 * always truthful without needing a background job.
 */
export async function reconcileRandom(random: RandomRecord): Promise<RandomRecord> {
  if (random.status === "open" && new Date(random.expiresAt).getTime() < Date.now()) {
    await getStore().markRandomExpired(random.id);
    return { ...random, status: "expired" };
  }
  return random;
}

/** True when a room already has a live (open, unexpired) Random Challenge. */
export async function hasOpenRandom(roomId: string): Promise<boolean> {
  const randoms = await getStore().listRandoms(roomId);
  const now = Date.now();
  return randoms.some(
    (r) => r.status === "open" && new Date(r.expiresAt).getTime() >= now
  );
}
