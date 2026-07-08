/**
 * The Know Me question bank.
 *
 * Each question is answered twice by each partner: once truthfully about
 * themselves, once as a guess about the other. Phrased in the first person so
 * a card reads like the two of you asking each other the same thing.
 * Categories keep rounds balanced and make adding themes trivial.
 */

export type KnowMeCategory =
  | "favorites"
  | "habits"
  | "memories"
  | "hypotheticals"
  | "sweet";

export interface KnowMeQuestion {
  id: string;
  text: string;
  category: KnowMeCategory;
}

/** Friendly labels + an emoji for each category, for UI. */
export const KNOWME_CATEGORY_META: Record<
  KnowMeCategory,
  { label: string; emoji: string }
> = {
  favorites: { label: "Favorites", emoji: "⭐" },
  habits: { label: "Habits", emoji: "🌀" },
  memories: { label: "Memories", emoji: "📸" },
  hypotheticals: { label: "What if", emoji: "🔮" },
  sweet: { label: "Sweet stuff", emoji: "🍯" },
};

export const KNOWME_QUESTIONS: KnowMeQuestion[] = [
  // ── Favorites ─────────────────────────────────────────────
  { id: "fav1", text: "What's my go-to comfort food?", category: "favorites" },
  { id: "fav2", text: "Which song would I blast on a road trip?", category: "favorites" },
  { id: "fav3", text: "What's my favorite way to waste an afternoon?", category: "favorites" },
  { id: "fav4", text: "What movie could I rewatch forever?", category: "favorites" },
  { id: "fav5", text: "What's my usual coffee or tea order?", category: "favorites" },
  { id: "fav6", text: "What's my favorite season, and why?", category: "favorites" },
  { id: "fav7", text: "Which snack do I always sneak into the cart?", category: "favorites" },
  { id: "fav8", text: "What's my dream vacation spot?", category: "favorites" },
  { id: "fav9", text: "What smell instantly makes me happy?", category: "favorites" },
  { id: "fav10", text: "What's my favorite thing to wear when nobody's watching?", category: "favorites" },
  { id: "fav11", text: "Which app do I open first in the morning?", category: "favorites" },
  { id: "fav12", text: "What's my karaoke song of choice?", category: "favorites" },
  { id: "fav13", text: "What dessert can I never say no to?", category: "favorites" },

  // ── Habits ────────────────────────────────────────────────
  { id: "hab1", text: "What do I always forget when leaving the house?", category: "habits" },
  { id: "hab2", text: "What's the first thing I do after waking up?", category: "habits" },
  { id: "hab3", text: "How do I act when I'm secretly stressed?", category: "habits" },
  { id: "hab4", text: "What's my weirdest little ritual?", category: "habits" },
  { id: "hab5", text: "What food do I claim to hate but barely tried?", category: "habits" },
  { id: "hab6", text: "How long do I actually take to get ready?", category: "habits" },
  { id: "hab7", text: "What do I do when I can't fall asleep?", category: "habits" },
  { id: "hab8", text: "What's my most-used emoji?", category: "habits" },
  { id: "hab9", text: "What chore do I always put off the longest?", category: "habits" },
  { id: "hab10", text: "What's my telltale sign that I'm hungry?", category: "habits" },
  { id: "hab11", text: "What do I hum or sing without noticing?", category: "habits" },
  { id: "hab12", text: "Which side of the bed do I secretly think is mine?", category: "habits" },

  // ── Memories ──────────────────────────────────────────────
  { id: "mem1", text: "What was I wearing when we first met?", category: "memories" },
  { id: "mem2", text: "What's my favorite memory of us so far?", category: "memories" },
  { id: "mem3", text: "What's the hardest I've ever laughed with you?", category: "memories" },
  { id: "mem4", text: "What was my first impression of you?", category: "memories" },
  { id: "mem5", text: "Which of our dates would I relive tomorrow?", category: "memories" },
  { id: "mem6", text: "What's a tiny moment with you I still think about?", category: "memories" },
  { id: "mem7", text: "What childhood story do I tell most often?", category: "memories" },
  { id: "mem8", text: "What's the best gift I've ever received?", category: "memories" },
  { id: "mem9", text: "What song takes me right back to when we started?", category: "memories" },
  { id: "mem10", text: "What's my proudest little achievement?", category: "memories" },
  { id: "mem11", text: "What's the most embarrassing thing I've done in front of you?", category: "memories" },
  { id: "mem12", text: "What did I want to be when I was a kid?", category: "memories" },

  // ── What if ───────────────────────────────────────────────
  { id: "hyp1", text: "If I won the lottery, what's the first thing I'd buy?", category: "hypotheticals" },
  { id: "hyp2", text: "If I could live anywhere for a year, where would it be?", category: "hypotheticals" },
  { id: "hyp3", text: "What would I do with a whole day of no responsibilities?", category: "hypotheticals" },
  { id: "hyp4", text: "If I could have dinner with anyone alive, who would it be?", category: "hypotheticals" },
  { id: "hyp5", text: "What superpower would I pick?", category: "hypotheticals" },
  { id: "hyp6", text: "If I had to eat one meal forever, what would it be?", category: "hypotheticals" },
  { id: "hyp7", text: "What would I name a pet we adopted together?", category: "hypotheticals" },
  { id: "hyp8", text: "If we could teleport to each other once a week, what would we do first?", category: "hypotheticals" },
  { id: "hyp9", text: "What job would I try for a day just for fun?", category: "hypotheticals" },
  { id: "hyp10", text: "If I could master any skill overnight, which one?", category: "hypotheticals" },
  { id: "hyp11", text: "What's my zombie-apocalypse role: leader, medic, or snack hoarder?", category: "hypotheticals" },
  { id: "hyp12", text: "If we opened a tiny shop together, what would we sell?", category: "hypotheticals" },

  // ── Sweet stuff ───────────────────────────────────────────
  { id: "swt1", text: "What little thing do you do that always makes my day?", category: "sweet" },
  { id: "swt2", text: "What's my favorite way to be comforted after a bad day?", category: "sweet" },
  { id: "swt3", text: "What compliment means the most to me?", category: "sweet" },
  { id: "swt4", text: "How do I show I love you without saying it?", category: "sweet" },
  { id: "swt5", text: "What's my idea of a perfect lazy day together?", category: "sweet" },
  { id: "swt6", text: "What do I miss most about you when we're apart?", category: "sweet" },
  { id: "swt7", text: "What's the first thing I'd do if you showed up at my door right now?", category: "sweet" },
  { id: "swt8", text: "What nickname do I secretly love being called?", category: "sweet" },
  { id: "swt9", text: "What's my love language, really?", category: "sweet" },
  { id: "swt10", text: "What future plan of ours am I most excited about?", category: "sweet" },
  { id: "swt11", text: "What do I brag about you to other people?", category: "sweet" },
  { id: "swt12", text: "What tiny habit of yours have I completely fallen for?", category: "sweet" },
];

/** How many questions make one round. */
export const KNOWME_ROUND_SIZE = 5;

/**
 * Pick `count` distinct questions at random, avoiding recently-used texts
 * when the bank is deep enough to allow it.
 */
export function pickKnowMeQuestions(
  exclude: string[] = [],
  count = KNOWME_ROUND_SIZE
): string[] {
  const avoid = new Set(exclude);
  const fresh = KNOWME_QUESTIONS.filter((q) => !avoid.has(q.text));
  const pool = fresh.length >= count ? [...fresh] : [...KNOWME_QUESTIONS];
  // Fisher–Yates, then take the first `count`.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((q) => q.text);
}

/** Look up a question's category from its text (rounds store texts). */
export function categoryOfQuestion(text: string): KnowMeCategory {
  return KNOWME_QUESTIONS.find((q) => q.text === text)?.category ?? "sweet";
}
