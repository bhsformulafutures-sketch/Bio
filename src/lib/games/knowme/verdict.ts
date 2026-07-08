/** Cute verdict copy for a Know Me score out of five. */
export function knowMeVerdict(score: number): string {
  switch (score) {
    case 5:
      return "Soulmate certified";
    case 4:
      return "Practically telepathic";
    case 3:
      return "Sweetly in sync";
    case 2:
      return "Getting warmer";
    case 1:
      return "Mysterious as ever";
    default:
      return "Time for a long call";
  }
}

/** A one-liner for the pair's combined result, shown on completed rounds. */
export function knowMePairVerdict(myScore: number, partnerScore: number): string {
  const total = myScore + partnerScore;
  if (total >= 9) return "You two are basically one brain in two time zones.";
  if (total >= 7) return "Scarily well matched — keep it up.";
  if (total >= 5) return "A lovely mix of knowing and discovering.";
  if (total >= 3) return "Plenty left to learn — how romantic.";
  return "Strangers to lovers arc, chapter one.";
}
