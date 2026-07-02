/**
 * The Random Challenge prompt pool.
 *
 * Each prompt is a small, snap-it-right-now photo mission. Categories keep
 * the pool balanced and make it trivial to add new themes later — just add
 * entries with a new `category`, no other code changes needed.
 */

export type PromptCategory =
  | "college"
  | "daily"
  | "city"
  | "relationship"
  | "wholesome"
  | "exploration"
  | "food"
  | "nature";

export interface Prompt {
  id: string;
  text: string;
  category: PromptCategory;
}

/** Friendly labels + an emoji for each category, for UI. */
export const CATEGORY_META: Record<PromptCategory, { label: string; emoji: string }> = {
  college: { label: "College life", emoji: "🎓" },
  daily: { label: "Daily life", emoji: "☕" },
  city: { label: "Your city", emoji: "🏙️" },
  relationship: { label: "Us", emoji: "💞" },
  wholesome: { label: "Wholesome", emoji: "🌼" },
  exploration: { label: "Exploration", emoji: "🧭" },
  food: { label: "Food", emoji: "🍜" },
  nature: { label: "Nature", emoji: "🍃" },
};

export const PROMPTS: Prompt[] = [
  // ── College life ──────────────────────────────────────────
  { id: "c1", text: "Your favorite study spot", category: "college" },
  { id: "c2", text: "Your current desk", category: "college" },
  { id: "c3", text: "A campus building you walk past", category: "college" },
  { id: "c4", text: "Your backpack, exactly as it is right now", category: "college" },
  { id: "c5", text: "The view from your usual seat in class", category: "college" },
  { id: "c6", text: "The messiest corner of your room", category: "college" },
  { id: "c7", text: "Your go-to library floor", category: "college" },
  { id: "c8", text: "A poster or photo on your wall", category: "college" },
  { id: "c9", text: "What's in your hand between classes", category: "college" },
  { id: "c10", text: "The longest line you waited in today", category: "college" },
  { id: "c11", text: "Your most-used pen or notebook", category: "college" },
  { id: "c12", text: "Where you'd nap on campus if you could", category: "college" },
  { id: "c13", text: "The vending machine that owns your money", category: "college" },

  // ── Daily life ────────────────────────────────────────────
  { id: "d1", text: "Your outfit today", category: "daily" },
  { id: "d2", text: "Your shoes right now", category: "daily" },
  { id: "d3", text: "Your breakfast", category: "daily" },
  { id: "d4", text: "Your coffee (or tea)", category: "daily" },
  { id: "d5", text: "Your view right now", category: "daily" },
  { id: "d6", text: "What's on your nightstand", category: "daily" },
  { id: "d7", text: "The first thing you touched this morning", category: "daily" },
  { id: "d8", text: "Your reflection in something that isn't a mirror", category: "daily" },
  { id: "d9", text: "The time on the nearest clock", category: "daily" },
  { id: "d10", text: "Whatever's in your pocket or bag", category: "daily" },
  { id: "d11", text: "Your handwriting, right now, saying hi", category: "daily" },
  { id: "d12", text: "The last thing you bought", category: "daily" },
  { id: "d13", text: "Your keys", category: "daily" },
  { id: "d14", text: "How you're sitting right now", category: "daily" },
  { id: "d15", text: "The weather out your window", category: "daily" },

  // ── Your city ─────────────────────────────────────────────
  { id: "y1", text: "A local landmark", category: "city" },
  { id: "y2", text: "A campus or city building you love", category: "city" },
  { id: "y3", text: "A funny sign you can find", category: "city" },
  { id: "y4", text: "Your favorite place in your city", category: "city" },
  { id: "y5", text: "The street you're on right now", category: "city" },
  { id: "y6", text: "A door you think is beautiful", category: "city" },
  { id: "y7", text: "Some graffiti or street art", category: "city" },
  { id: "y8", text: "The best coffee shop near you", category: "city" },
  { id: "y9", text: "A bus stop or train platform", category: "city" },
  { id: "y10", text: "The oldest thing you can find nearby", category: "city" },
  { id: "y11", text: "A shop window that caught your eye", category: "city" },
  { id: "y12", text: "Where you'd take me first if I visited", category: "city" },

  // ── Us ────────────────────────────────────────────────────
  { id: "r1", text: "Something that reminds you of me", category: "relationship" },
  { id: "r2", text: "A selfie, right now, no fixing your hair", category: "relationship" },
  { id: "r3", text: "Something the same color as my eyes", category: "relationship" },
  { id: "r4", text: "A spot you wish we were sitting together", category: "relationship" },
  { id: "r5", text: "Something that made you think of an inside joke", category: "relationship" },
  { id: "r6", text: "Where you'd want our next date to be", category: "relationship" },
  { id: "r7", text: "Something you'd give me if I were there", category: "relationship" },
  { id: "r8", text: "The last thing that made you smile about us", category: "relationship" },
  { id: "r9", text: "A heart you can find in the wild", category: "relationship" },
  { id: "r10", text: "Your hand, so I can imagine holding it", category: "relationship" },
  { id: "r11", text: "Something soft you wish we could share", category: "relationship" },

  // ── Wholesome ─────────────────────────────────────────────
  { id: "w1", text: "The prettiest thing you saw today", category: "wholesome" },
  { id: "w2", text: "A place that makes you happy", category: "wholesome" },
  { id: "w3", text: "Something that made you laugh recently", category: "wholesome" },
  { id: "w4", text: "A small thing you're grateful for right now", category: "wholesome" },
  { id: "w5", text: "Something cozy near you", category: "wholesome" },
  { id: "w6", text: "A color that matches your mood", category: "wholesome" },
  { id: "w7", text: "Something that smells amazing (show us anyway)", category: "wholesome" },
  { id: "w8", text: "The comfiest spot in the room", category: "wholesome" },
  { id: "w9", text: "Something that felt like a tiny win today", category: "wholesome" },
  { id: "w10", text: "A song you're playing — show the screen", category: "wholesome" },
  { id: "w11", text: "Something that made today a little softer", category: "wholesome" },

  // ── Exploration ───────────────────────────────────────────
  { id: "e1", text: "Something blue", category: "exploration" },
  { id: "e2", text: "Something older than you", category: "exploration" },
  { id: "e3", text: "The tallest thing you can see", category: "exploration" },
  { id: "e4", text: "Something round", category: "exploration" },
  { id: "e5", text: "A pattern or texture you like", category: "exploration" },
  { id: "e6", text: "Something you've walked past a hundred times", category: "exploration" },
  { id: "e7", text: "The most colorful thing nearby", category: "exploration" },
  { id: "e8", text: "Something tiny, up close", category: "exploration" },
  { id: "e9", text: "A reflection", category: "exploration" },
  { id: "e10", text: "A shadow you think looks cool", category: "exploration" },
  { id: "e11", text: "Something that looks like a face", category: "exploration" },
  { id: "e12", text: "The number 7, found somewhere", category: "exploration" },
  { id: "e13", text: "Something shiny", category: "exploration" },
  { id: "e14", text: "Something that doesn't belong where it is", category: "exploration" },

  // ── Food ──────────────────────────────────────────────────
  { id: "f1", text: "Your dinner", category: "food" },
  { id: "f2", text: "Your lunch", category: "food" },
  { id: "f3", text: "A snack you're hiding from everyone", category: "food" },
  { id: "f4", text: "What's in your fridge right now", category: "food" },
  { id: "f5", text: "The best thing you ate today", category: "food" },
  { id: "f6", text: "Your favorite mug", category: "food" },
  { id: "f7", text: "Something sweet nearby", category: "food" },
  { id: "f8", text: "A drink you're having", category: "food" },
  { id: "f9", text: "The most questionable thing in your kitchen", category: "food" },
  { id: "f10", text: "A meal you wish we were sharing", category: "food" },

  // ── Nature ────────────────────────────────────────────────
  { id: "n1", text: "A sunset", category: "nature" },
  { id: "n2", text: "A tree you can see", category: "nature" },
  { id: "n3", text: "A flower", category: "nature" },
  { id: "n4", text: "A random animal", category: "nature" },
  { id: "n5", text: "The sky right now", category: "nature" },
  { id: "n6", text: "A cloud that looks like something", category: "nature" },
  { id: "n7", text: "A plant (yours or a stranger's)", category: "nature" },
  { id: "n8", text: "Something green and growing", category: "nature" },
  { id: "n9", text: "The moon, if it's out", category: "nature" },
  { id: "n10", text: "A leaf you think is perfect", category: "nature" },
  { id: "n11", text: "Water in any form", category: "nature" },
  { id: "n12", text: "The prettiest bit of sky you can find", category: "nature" },
];

/** Pick a prompt at random, optionally avoiding recently-used ones. */
export function pickPrompt(exclude: string[] = []): Prompt {
  const avoid = new Set(exclude);
  const pool = PROMPTS.filter((p) => !avoid.has(p.text));
  const candidates = pool.length > 0 ? pool : PROMPTS;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Look up a prompt's category from its text (prompts are stored by text). */
export function categoryOfPrompt(text: string): PromptCategory {
  return PROMPTS.find((p) => p.text === text)?.category ?? "daily";
}
