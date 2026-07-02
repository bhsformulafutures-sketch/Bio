# Other Half 📸✏️

A private game for exactly two people. One of you uploads a photo — the app
hides part of it. The other only sees the visible half and draws what they
imagine is missing. Then the truth is revealed with a satisfying animation,
a before/after comparison slider, and every round is saved forever in your
shared gallery.

No accounts, no feeds, no likes. Just a room code and the two of you.

## How it works

1. **Create a room** → you get a 6-letter code.
2. Your partner **joins with the code**. The room is now permanently yours;
   both browsers reconnect automatically via an httpOnly cookie.
3. Either of you sends a **challenge**: pick a photo, choose which part to
   hide (left / right / top / bottom / 🎲 random), send.
4. The other person sees **only the visible part** and draws the missing
   half with a minimal pencil/eraser toolkit (undo, redo, clear — nothing
   else, on purpose).
5. **Finish** → countdown → the mask slides away → the original fades in
   under the drawing → a draggable comparison slider → saved to the gallery.

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

So `npm run dev` works with **zero setup**, and production just needs two
env vars.

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000 — no configuration needed
```

To try the full two-person flow locally, open a second browser (or a private
window) and join with the room code.

## Deploying (Vercel + Supabase)

1. Create a Supabase project, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the SQL editor. It creates the tables **and** the public `photos`
   storage bucket.
2. Push this repo to GitHub and import it into Vercel.
3. Add two environment variables in Vercel:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → service_role key
4. Deploy. Done.

## Architecture notes

- **Privacy of the answer.** At creation time the client renders two images:
  the untouched `original.jpg` and a `visible.jpg` with the hidden region
  blanked. While a challenge is waiting, the API only ever hands the guesser
  the visible version — the original URL is withheld server-side, so there is
  no way to peek.
- **Three stored artifacts per round**: `original.jpg`, transparent
  `drawing.png`, and `merged.jpg` (drawing layered over the original —
  composited deterministically on the client). If the merge upload is
  interrupted, the result view rebuilds and re-uploads it automatically.
- **Never lose progress.** Strokes are normalized (resolution-independent)
  and autosaved to `localStorage` after every action; an accidental refresh
  restores the draft. Submissions are atomic compare-and-swap on the server,
  so a double-tap or a stale tab can't overwrite a completed round.
- **Images** are downscaled to ≤1600px and JPEG-compressed client-side
  before upload; gallery images lazy-load.

## Project structure

```
src/
  app/
    page.tsx                    landing — create/join room
    home/page.tsx               room home: your turn, waiting, gallery
    new/page.tsx                create a challenge
    challenge/[id]/page.tsx     draw → reveal → result (state machine)
    api/                        route handlers (all data access)
  components/                   DrawingBoard, RevealSequence, CompareSlider…
  lib/
    store/                      Store interface + Supabase/local backends
    image-client.ts             compression, stroke replay, compositing
    region.ts                   hidden-region math
supabase/schema.sql             tables + storage bucket
```
