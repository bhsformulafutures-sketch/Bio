# The Other Half 💞

A tiny, private world for two — playful photo mini-games and shared
moments, just the two of you. Sign up with your email, create or join a
room with your partner, and start playing.

No feeds, no likes, no strangers. Just the two of you.

## How it works

1. **Sign up** with your email address (a one-time code verifies it — the
   address is only ever used to deliver notifications).
2. **Create your profile** — a name and a little emoji avatar.
3. **Create a room** → you get a 6-letter code, or **join** your partner's
   with theirs. The room permanently links the two of you; your account
   carries the connection, so it survives across browsers and devices.
4. Play together:
   - **Other Half** 🎨 — one of you hides part of a photo, the other
     imagines and draws the missing piece. Then the truth is revealed with
     a satisfying animation and a before/after comparison slider.
   - **Random Challenge** 🎲 — either of you starts one, the app picks a
     surprise prompt from a pool of ~100 (college life, your city,
     wholesome moments, "us"...), and you both have 24 hours to answer
     with a photo. Neither photo is revealed until you've both answered.
5. Every finished round is saved forever in your shared **Memories** gallery.

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

A **user** is a verified email address + a profile (name, emoji avatar). A
**participant** is that person's membership in one specific room — so the
same person can belong to multiple rooms, and each room still only ever
has two participants.

- `src/lib/auth/email.ts` — email normalization/validation.
- `src/lib/auth/otp.ts` — one-time code generation & hashing (HMAC, peppered
  with `AUTH_SECRET`, 10-minute expiry, 5 attempts).
- `src/lib/session.ts` — two httpOnly cookies: `oh_uid` (who you are) and
  `oh_room` (which room you're currently looking at).

In zero-config dev (no email provider configured), verification codes are
returned in the API response and surfaced on-screen instead of emailed, so
the whole flow works with no external accounts.

### Notifications

`src/lib/notify/` is a small provider abstraction so email delivery can be
swapped without touching call sites:

| Provider | When | Behavior |
| --- | --- | --- |
| `console` | no `RESEND_*` vars set | Logs the message to the server console (dev) |
| `resend` | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set | Sends real email via Resend's REST API |

`src/lib/notify/notifications.ts` holds the high-level events: a challenge
is sent, a challenge is completed, a Random Challenge starts, a Random
Challenge is complete. Adding a new provider means adding one file under
`src/lib/notify/providers/` and wiring it into `getEmailProvider()`.

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

Verification codes appear in the API response (and a toast in the UI) since
no email provider is configured. To try the full two-person flow locally,
open a second browser (or a private window) and sign up with a different
email address, then join with the room code.

## Deploying (Vercel + Supabase)

1. Create a Supabase project, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the SQL editor. It's safe to re-run on a fresh database — every
   statement is additive (`if not exists` / `add column if not exists`).
   It creates the tables **and** the public `photos` storage bucket.
2. Push this repo to GitHub and import it into Vercel.
3. Add environment variables in Vercel:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → service_role key
   - `AUTH_SECRET` — a long random string (used to hash verification codes)
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — optional; only needed to send
     real email. Without them, verification codes are logged server-side
     instead of emailed, so leaving them unset is fine for a soft launch,
     but nobody will receive real emails. `RESEND_FROM_EMAIL` needs a
     verified sending domain in your Resend account.
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
    page.tsx                    onboarding: email → code → profile → room
    home/page.tsx                room home: both games, your turn, memories
    new/page.tsx                 create an Other Half challenge
    challenge/[id]/page.tsx      Other Half: draw → reveal → result
    random/[id]/page.tsx         Random Challenge: answer → reveal
    api/
      auth/                      request-code, verify, state, logout
      profile/                   name + avatar
      room/, rooms/               create/join/switch/delete
      challenges/                 Other Half
      randoms/                    Random Challenge
      files/                      local-store file serving
  components/                    DrawingBoard, RevealSequence, RandomCard…
  lib/
    auth/                        email + OTP helpers
    notify/                      email provider abstraction + events
    games/random/                prompts, 24h logic, countdown formatting
    store/                       Store interface + Supabase/local backends
    image-client.ts              compression, stroke replay, compositing
    region.ts                    hidden-region math (Other Half)
    session.ts                   auth + active-room cookies
supabase/schema.sql              tables + storage bucket (additive)
```
