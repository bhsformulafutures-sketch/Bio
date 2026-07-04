# The Other Half 💞

A tiny, private world for two — playful photo mini-games and shared
moments, just the two of you. Pick a name, choose a room code, and start
playing. No email, no passwords, no strangers.

## How it works

1. **Make it yours** — pick a nickname and a little emoji avatar. That's the
   whole sign-up: your device is issued a token and stays signed in, no
   email or verification codes.
2. **Create a room** → choose your own memorable code (`SUNFLOWERS`,
   `OURPLACE`, `LATECALLS`…), or **join** your partner's with theirs. Codes
   are 4–20 characters and case-insensitive. Once two people are in, the
   room locks.
3. Play together:
   - **Other Half** 🎨 — one of you hides part of a photo, the other
     imagines and draws the missing piece. Then the truth is revealed with
     a satisfying animation and a before/after comparison slider.
   - **Random Challenge** 🎲 — either of you starts one, the app picks a
     surprise prompt from a pool of ~100 (college life, your city,
     wholesome moments, "us"...), and you both have 24 hours to answer
     with a photo. Neither photo is revealed until you've both answered.
4. Every finished round is saved forever in your shared **Memories** gallery,
   and you can gather favourites into shared **Albums** 📚.

### Rooms

The header chip is a **room switcher**: one account can belong to several
rooms (one per partner-in-crime). From the menu you can hop between rooms,
create a new one, join another with a code, copy the current code, sign
out, or **delete a room** — which permanently removes every photo, drawing
and memory in it, for both people (two-tap confirm).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Plain Canvas 2D** for drawing (deliberately not Konva/Fabric — freehand
  pencil + eraser needs no scene graph, and a raw canvas keeps the bundle
  small and mobile drawing buttery)
- **Supabase** — Postgres + Storage, accessed *only* from server-side route
  handlers with the service-role key. The browser never holds a Supabase key.
- **Vercel** for hosting

### Storage abstraction

`src/lib/store/` defines one small `Store` interface with two backends:

| Backend | When | Where data lives |
| --- | --- | --- |
| `SupabaseStore` | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set | Postgres + Storage bucket |
| `LocalStore` | no env vars (dev/demo) | `.data/` JSON + files |

So `npm run dev` works with **zero setup**, and production just needs a
couple of env vars.

### Identity & auth

Identity is **device-local** — no email, no passwords, no paid SMS. A
**user** is a nickname + emoji avatar, issued an opaque token that lives in
an httpOnly cookie so the browser stays signed in. A **participant** is that
person's membership in one specific room — so the same person can belong to
multiple rooms, and each room still only ever has two participants.

- `src/lib/room-code.ts` — room-code normalization (uppercase, 4–20 chars,
  case-insensitive) + validation + friendly suggestions.
- `src/lib/avatars.ts` — the curated emoji avatar set.
- `src/lib/session.ts` — two httpOnly cookies: `oh_uid` (who you are) and
  `oh_room` (which room you're currently looking at).
- `POST /api/account` is the whole sign-in: pick a nickname + avatar and
  you're in. Creating a room takes your chosen code (`POST /api/room`);
  joining uses the partner's (`POST /api/room/join`), locking at two.

### Notifications

The app is wired for **browser push** (Web Push / VAPID). Delivery is fully
decoupled behind one seam so producers never know how a message is sent:

- `src/lib/notify/events.ts` — the typed event vocabulary: `challenge_received`,
  `challenge_completed`, `daily_available`, `deadline_reminder`.
- `src/lib/notify/notifications.ts` — high-level producers (a challenge is
  sent/completed, a Random starts/completes, a daily is available, a deadline
  nears). Call sites just build an event.
- `src/lib/notify/dispatch.ts` — resolves a room's recipients and their push
  subscriptions and fans out the event, pruning dead endpoints. A failed send
  never breaks the action that triggered it.
- `src/lib/notify/push.ts` — VAPID-configured `web-push` sender.
- `public/sw.js` + `src/lib/push-client.ts` — the service worker and the
  client glue (register, request permission, subscribe/unsubscribe).

Push stays dormant until `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` are set —
with no keys, events are logged server-side in dev. Generate a keypair with
`npx web-push generate-vapid-keys`. The home-screen toggle shows a muted
"Soon" state until keys exist, then becomes interactive.

### Albums

Shared **albums** collect memories from either game into named collections.
`src/lib/store` gains an `albums` + `album_items` model (a memory is
referenced loosely by `(kind, id)` so one album can mix both games); the
`/api/albums` routes cover create/list/rename/delete and add/remove, and
covers auto-resolve to the most recent memory.

### Mini-games

Each game keeps its own logic under `src/lib/games/<game>/`, with its own
API routes and page. Adding a new game means a new folder, a new route
namespace, and a new page — no changes to auth, rooms, or the store
interface required.

- `other-half` (the original game — hide/draw/reveal) lives inline for now
  since it predates this structure; its logic sits in `src/lib/region.ts`
  and `src/lib/image-client.ts`.
- `random` (`src/lib/games/random/`) — the prompt pool (`prompts.ts`), the
  24-hour expiry/guard logic (`service.ts`), and countdown formatting
  (`time.ts`).

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000 — no configuration needed
```

To try the full two-person flow locally, open a second browser (or a private
window), pick a different nickname, and join with the room code the first
person chose.

## Deploying (Vercel + Supabase)

1. Create a Supabase project, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the SQL editor. It's safe to re-run on a fresh database — every
   statement is additive (`if not exists` / `add column if not exists`).
   It creates the tables **and** the public `photos` storage bucket.
2. Push this repo to GitHub and import it into Vercel.
3. Add environment variables in Vercel:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → service_role key
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — optional; only needed to
     deliver browser push. Generate once with `npx web-push
     generate-vapid-keys`. Without them, push stays off (events log
     server-side), which is fine for a soft launch.
   - `VAPID_SUBJECT` — optional contact URL (`mailto:` or `https:`).
4. Deploy. Done.

## Architecture notes

- **Privacy of the answer.** At creation time the client renders two images:
  the untouched `original.jpg` and a `visible.jpg` with the hidden region
  blanked. While a challenge is waiting, the API only ever hands the guesser
  the visible version — the original URL is withheld server-side, so there is
  no way to peek. Random Challenge follows the same principle: a partner's
  photo is withheld until both people have answered.
- **Three stored artifacts per Other Half round**: `original.jpg`, transparent
  `drawing.png`, and `merged.jpg` (drawing layered over the original —
  composited deterministically on the client). If the merge upload is
  interrupted, the result view rebuilds and re-uploads it automatically.
- **Never lose progress.** Strokes are normalized (resolution-independent)
  and autosaved to `localStorage` after every action; an accidental refresh
  restores the draft. Submissions are atomic compare-and-swap on the server,
  so a double-tap or a stale tab can't overwrite a completed round.
- **Images** are downscaled to ≤1600px and JPEG-compressed client-side
  before upload; gallery images lazy-load.
- **Random Challenge's 24-hour clock** is reconciled lazily on read (an
  `open` challenge whose `expires_at` has passed flips to `expired` the
  next time anyone loads it) — no background job required.

## Project structure

```
src/
  app/
    page.tsx                    onboarding: nickname/avatar → create/join room
    template.tsx                 shared page-transition wrapper
    home/page.tsx                room home: albums, both games, memories
    new/page.tsx                 create an Other Half challenge
    challenge/[id]/page.tsx      Other Half: draw → reveal → result
    random/[id]/page.tsx         Random Challenge: answer → reveal
    album/[id]/page.tsx          one album: memories + rename/delete
    api/
      account/                   create/update device identity
      auth/                      state, logout
      room/, rooms/               create (custom code)/join/switch/delete
      challenges/                 Other Half
      randoms/                    Random Challenge
      albums/                     create/list/rename/delete + items
      push/                       VAPID key + subscribe/unsubscribe
      files/                      local-store file serving
  components/                    DrawingBoard, RevealSequence, AlbumStrip,
    motion/                      MotionProvider, AmbientBackground, Reveal,
                                 BlurImage, Pressable, PageTransition
  lib/
    motion.ts                    shared timing/easing/spring tokens
    room-code.ts, avatars.ts     identity + room-code helpers
    notify/                      events → dispatch → web-push (VAPID)
    push-client.ts               service-worker + subscription glue
    games/random/                prompts, 24h logic, countdown formatting
    store/                       Store interface + Supabase/local backends
    image-client.ts              compression, stroke replay, compositing
    region.ts                    hidden-region math (Other Half)
    session.ts                   auth + active-room cookies
public/sw.js                     push service worker
supabase/schema.sql              tables + storage bucket (additive)
```
