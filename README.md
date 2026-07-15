# The Other Half 💞

A tiny, private world for two — little games, a shared radio, and a
photobooth, just the two of you. Pick a name, choose a room code, and
start playing. No email, no passwords, no strangers.

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
     surprise prompt from a pool of ~100, and you both have 24 hours to
     answer with a photo. Neither photo is revealed until you've both
     answered.
   - **Where Am I?** 📍 — snap a photo of where you are; they get four
     typed guesses, earning a hint after each miss.
   - **Know Me** 💭 — five questions; you both answer for yourselves *and*
     guess the other's answers, then rate the guesses.
   - **Photobooth** 📸 — when you're both online, a synchronized countdown
     snaps a classic two-column strip across both cameras at once.
   - **The radio** 📻 — every room is a station (`SUNFLOWERS` becomes
     *SUNFLOWERS FM*): a shared Side A queue, Side B dedications with a
     lyric and a handwritten cassette label, and a listen-together mode —
     press play and you're **on air**; your partner gets a "tune in"
     banner and joins the same song.
4. Every finished round is saved forever in your shared **Memories** wall,
   and you can gather favourites into shared **Albums** 📚.

### Rooms

The header chip is a **room switcher**: one account can belong to several
rooms (one per partner-in-crime). From the menu you can hop between rooms,
create a new one, join another with a code, copy the current code, sign
out, or **delete a room** — which permanently removes every photo, drawing
and memory in it, for both people (two-tap confirm).

## The look — "Paper & Ink"

The UI is an analog scrapbook: warm cream paper, sepia ink, a marker-red
accent, hairline borders and hard offset shadows instead of soft glows.
Games are punched **admission tickets**, memories are **tilted polaroids**
with handwritten captions (deterministic per-item tilt via
`src/lib/tilt.ts`), photos get **washi-tape** strips, and the radio is a
drawn cassette deck with spinning spools. Display type is Instrument
Serif; handwriting is Caveat (both self-hosted at build via `next/font`).
Wallpapers are paper stocks — graph, ruled, kraft, corkboard, blueprint —
chosen from the header and stored per device.

Two ambient motion layers keep the page alive without getting in the way:
drifting blurred blobs + twinkling particles (`AmbientBackground`), and
rare "delight" moments — a folded paper airplane crossing the screen,
petals, floating hearts, a doodled sticky note (`AmbientDelight`). Both
pause behind modals and disappear entirely under `prefers-reduced-motion`.
The primitives live in `src/components/ui.tsx`: `Panel`, `Ticket`,
`Polaroid`, `TapeStrip`, `Sticker`.

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

### Identity, auth & presence

Identity is **device-local** — no email, no passwords, no paid SMS. A
**user** is a nickname + emoji avatar, issued an opaque token that lives in
an httpOnly cookie so the browser stays signed in. A **participant** is that
person's membership in one specific room — so the same person can belong to
multiple rooms, and each room still only ever has two participants.

- `src/lib/session.ts` — two httpOnly cookies: `oh_uid` (who you are) and
  `oh_room` (which room you're currently looking at).
- `GET /api/me` doubles as the **presence heartbeat**: every poll updates
  `participants.last_seen_at`, and a partner seen within 35s counts as
  online (`partnerOnline`). Presence gates the photobooth and scopes the
  **on air** chip (`partnerOnAir`) shown in the header.
- `src/lib/room-code.ts` — room-code normalization + validation;
  `src/lib/avatars.ts` — the curated emoji avatar set.

### The radio

- **Tracks** (`tracks` table): paste a YouTube / Spotify / Apple Music /
  SoundCloud link. `src/lib/music.ts` parses it into a provider + embed
  URL, and `POST /api/tracks` fills the title/artist server-side from the
  provider's keyless **oEmbed** endpoint (4s timeout; a typed title always
  wins, and plain links just ask for one). Playback is the provider's own
  embed — no audio files are stored.
- **Dedications** are tracks with a lyric and an optional handwritten
  cassette label drawn on `NoteCanvas` (stored as a PNG). Only the sender
  can take a dedication back, and deleting one cleans up its note file.
- **Listen-together** (`player_states` table, one row per room):
  `PUT /api/player` puts a track on air; the partner's radio page (5s
  poll) shows a tune-in banner. `GET /api/player` returns `serverNow`, so
  tune-in can compute the elapsed offset against a shared clock — YouTube
  embeds join mid-song via `?start=`; the other providers start from the
  top. Either partner can stop the broadcast; deleting the playing track
  clears it too. Best-effort by design: "same song, roughly same time."

### Photobooth

Both partners must be online; `POST /api/booth` opens a booth and the
partner is notified (`booth_started`). Once both cameras are ready the
server sets a shared `start_at`, and both devices run the same countdown
against the server clock, uploading one mirrored square JPEG per shot.
When shots finish, **either device** composites the classic strip
client-side (`compositeBoothStrip`) — the initiator leads, the partner
steps in after a grace period, and the server keeps the first strip
uploaded — so a closed tab never orphans a finished booth. Completed
booths open view-only, without a camera permission prompt.

### Notifications

The app is wired for **browser push** (Web Push / VAPID). Delivery is fully
decoupled behind one seam so producers never know how a message is sent:

- `src/lib/notify/events.ts` — the typed event vocabulary:
  `challenge_received`, `challenge_completed`, `daily_available`,
  `deadline_reminder`, `dedication_received`, `now_playing`,
  `booth_started`.
- `src/lib/notify/notifications.ts` — high-level producers (a challenge is
  sent/completed, a dedication arrives, something goes on air, a booth
  opens…). Call sites just build an event.
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

Shared **albums** collect memories from the games into named collections.
`src/lib/store` has an `albums` + `album_items` model (a memory is
referenced loosely by `(kind, id)` so one album can mix games); the
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
- `random` (`src/lib/games/random/`) — the prompt pool, the 24-hour
  expiry/guard logic, and countdown formatting.
- `whereami` (`src/lib/games/whereami/`) — fuzzy answer matching and
  hint gating (the answer and unearned hints are stripped server-side).
- `knowme` (`src/lib/games/knowme/`) — the question bank, round service,
  and verdict lines.

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
   in the SQL editor. It's safe to re-run on an existing database — every
   statement is additive (`if not exists` / `add column if not exists`).
   It creates the tables (including `player_states` for the radio) **and**
   the public `photos` storage bucket.
2. Push this repo to GitHub and import it into Vercel.
3. Add environment variables in Vercel:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → service_role key
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — optional; only needed to
     deliver browser push. Generate once with `npx web-push
     generate-vapid-keys`. Without them, push stays off (events log
     server-side), which is fine for a soft launch.
   - `VAPID_SUBJECT` — optional contact URL (`mailto:` or `https:`).
4. Deploy. Done. (oEmbed metadata needs no keys or env vars.)

## Architecture notes

- **Privacy of the answer.** At creation time the client renders two images:
  the untouched `original.jpg` and a `visible.jpg` with the hidden region
  blanked. While a challenge is waiting, the API only ever hands the guesser
  the visible version — the original URL is withheld server-side, so there is
  no way to peek. Random Challenge, Where Am I and Know Me follow the same
  principle: what you haven't earned yet is stripped before it leaves the
  server.
- **Three stored artifacts per Other Half round**: `original.jpg`, transparent
  `drawing.png`, and `merged.jpg` (drawing layered over the original —
  composited deterministically on the client). If the merge upload is
  interrupted, the result view rebuilds and re-uploads it automatically.
- **Never lose progress.** Strokes are normalized (resolution-independent)
  and autosaved after every action. Submissions are atomic compare-and-swap
  on the server, so a double-tap or a stale tab can't overwrite a completed
  round.
- **Shared clocks, not shared sockets.** Everything realtime-ish (booth
  countdowns, radio tune-in offsets) aligns devices against `serverNow`
  returned by the API and plain polling — no websockets to babysit.
- **Images** are downscaled to ≤1600px and JPEG-compressed client-side
  before upload; gallery images lazy-load.
- **Random Challenge's 24-hour clock** is reconciled lazily on read — no
  background job required.

## Project structure

```
src/
  app/
    page.tsx                    onboarding: nickname/avatar → create/join room
    template.tsx                 shared page-transition wrapper
    home/page.tsx                the desk: tickets, pinned note, polaroid wall
    new/page.tsx                 create an Other Half challenge
    challenge/[id]/page.tsx      Other Half: draw → reveal → result
    random/[id]/page.tsx         Random Challenge: answer → reveal
    whereami/…                   Where Am I: new round + guessing
    knowme/…                     Know Me: rounds list + play
    booth/[id]/page.tsx          synchronized photobooth
    music/page.tsx               the radio: cassette deck, Side A/B, tune-in
    album/[id]/page.tsx          one album: memories + rename/delete
    api/
      account/, auth/, me/       device identity, state, presence heartbeat
      room/, rooms/               create/join/switch/delete
      challenges/, randoms/       the photo games
      whereami/, knowme/          the guessing games
      booth/, booths/             live photobooth + finished strips
      tracks/                     the radio's queue + dedications (oEmbed)
      player/                     shared "on air" state (listen-together)
      albums/                     create/list/rename/delete + items
      push/                       VAPID key + subscribe/unsubscribe
      files/                      local-store file serving
  components/                    DrawingBoard, RevealSequence, AlbumStrip,
    ui.tsx                       Panel, Ticket, Polaroid, TapeStrip, Sticker…
    motion/                      MotionProvider, AmbientBackground,
                                 AmbientDelight, BlurImage, Pressable
  lib/
    motion.ts                    shared timing/easing/spring tokens
    tilt.ts                      deterministic scrapbook tilt jitter
    music.ts                     link parsing + oEmbed metadata
    room-code.ts, avatars.ts     identity + room-code helpers
    notify/                      events → dispatch → web-push (VAPID)
    games/…                      per-game logic
    store/                       Store interface + Supabase/local backends
    image-client.ts              compression, stroke replay, compositing
    session.ts                   auth + active-room cookies
public/sw.js                     push service worker
supabase/schema.sql              tables + storage bucket (additive)
```
