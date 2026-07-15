# Site Overhaul Plan — "The Other Half"

> **Status: implemented.** All five phases below landed on this branch
> (see the phase-by-phase commits). Kept as the design record for the
> "Paper & Ink" language and the radio architecture.

## Context

The app has grown from two mini-games into a six-feature private world for
two: four games (Other Half, Random Challenge, Know Me, Where Am I), a
synchronized photobooth, and a record player — plus presence, wallpapers,
and the ambient motion system. Two problems prompted this overhaul:

1. **The newer addons feel bolted on.** The record player especially: its
   "shared queue" isn't actually shared (now-playing is device-local
   `useState`), the `artist` column is plumbed through the entire stack but
   never filled by any UI, either partner can delete the other's
   dedications, nothing notifies the partner when a song or dedication
   arrives, and deleting a track orphans its note PNG in storage.
2. **The site looks AI-generated.** Every surface is the same
   `rounded-3xl` white card with a rose-tinted soft shadow; every game tile
   is a pastel `bg-gradient-to-br`; headings are default Georgia; every
   page is one centered column of stacked cards. The parts worth keeping —
   the ambient background blobs and the "delight" layer (paper airplane,
   petals, floating hearts, sticky notes) — are cleanly separated in
   `src/components/motion/` and survive untouched.

**Decisions made:**
- Full visual redesign, applied site-wide in phases.
- New design language: **analog scrapbook** — paper, tape, ink hairlines,
  tilted polaroids, handwritten labels.
- The music feature becomes the centerpiece, reworked in three directions
  at once: **cassette/mixtape aesthetic**, **radio-station framing**, and
  **real listen-together sync**.
- De-AI focus is **visual sameness + layout/structure** (not a copy/tone
  rewrite, not emoji removal).
- **The ambient motion system stays** (`AmbientBackground`,
  `AmbientDelight`, the pause gate in `src/lib/ambient.ts`) — only
  re-tinted to the new palette.

The data/auth architecture (Store interface, server-only Supabase, cookie
sessions, dual Local/Supabase backends) is clean and stays as-is. All
schema changes are additive, in keeping with `supabase/schema.sql`'s
`if not exists` convention, and every store change is implemented in both
`src/lib/store/local.ts` and `src/lib/store/supabase.ts`.

---

## Design direction: analog scrapbook

### Tokens (`src/app/globals.css`)

Replace the "Dusk & Blush" pastel set with a warm paper-and-ink set.
Indicative values (tune during implementation):

```
--color-paper:   #f7f1e5   warm cream paper (was #fdf6f3)
--color-kraft:   #e8dcc8   kraft-envelope tan (new)
--color-surface: #fffdf8   paper white
--color-ink:     #3a2f28   warm sepia ink (was plum #2c2230)
--color-soft:    #7a6c60   --color-faint: #ab9d8f
--color-line:    #d9cbb8   pencil hairline
--color-accent:  #c94f4f   marker red / raspberry (was rose #e8607d)
--color-dusk:    #5f6fa8   fountain-pen blue (replaces periwinkle role)
--color-gold:    #d9a441   kept for delight sparks, warmed
--tape-pink / --tape-blue / --tape-mint / --tape-gold: translucent
  washi-tape tints (new, used by the TapeStrip primitive)
```

- **Shadows:** kill the three soft rose shadows. Surfaces sit on paper via
  a 1px ink hairline (`border-line`) plus, where lift is needed, one hard
  offset shadow (`2px 3px 0 rgb(58 47 40 / 0.08)`) — paper on paper, not
  glow.
- **Radii:** `rounded-lg` maximum on panels (paper corners), `rounded-sm`
  on labels/stickers. `rounded-3xl` disappears.
- **Typography** via `next/font/google` (self-hosted at build, no runtime
  requests): display = **Instrument Serif** (regular + italic — italics for
  pull-quotes/lyrics), handwriting = **Caveat** (`.font-hand`, for cassette
  labels, polaroid captions, sticker text). Body stays the system sans
  stack — deliberately not Inter. Replaces `--font-display: Georgia`.
- **Textures:** the existing `.dotted` pattern generalizes into a small set
  of pure-CSS papers: grid paper, ruled paper, kraft. A `.torn-edge` CSS
  mask (zigzag `clip-path`) for panel tops used sparingly.
- **Wallpapers** (`WallpaperPicker.tsx` + `body[data-wallpaper]` rules):
  the 7 pastel gradients become paper swatches — plain, grid, ruled,
  kraft, corkboard, blueprint, dusk-paper. Same mechanism (localStorage +
  pre-paint inline script in `layout.tsx`), new looks.
- **Ambient re-tint only:** blob/particle colors in
  `src/components/motion/AmbientBackground.tsx` and the sticky-note/heart
  colors in `AmbientDelight.tsx` move to the new palette. Behavior,
  timings, reduced-motion handling, and the pause gate are untouched.

### Surface primitives (`src/components/ui.tsx`)

The uniform `Card` is replaced by a small family (old `Card` call sites
migrate to whichever fits):

- **`Panel`** — flat paper, hairline border, optional torn top edge. The
  default container.
- **`Ticket`** — punched-hole ticket (radial-gradient notches) for game
  entry tiles.
- **`Polaroid`** — white frame, photo, `.font-hand` caption strip, tilt.
- **`TapeStrip`** — rotated translucent washi strip, decorates attachments
  (photos "taped" to the page, pinned notes).
- **`Sticker`** — small rotated label chip (replaces `Badge`).

Promote `tiltFor` (currently private in `src/components/GalleryCard.tsx`)
to `src/lib/tilt.ts` — deterministic per-id rotation jitter is the core
anti-uniformity tool and gets used everywhere (polaroids, stickers,
tickets).

### Layout principles (the de-AI rules)

1. No page is a single centered column of identical cards. Each page gets
   one distinctive composition.
2. Rotation jitter (±1–2.5°) on collage elements; never on functional
   controls or text blocks.
3. Hairlines and paper edges instead of shadows; flat color instead of
   gradients (the only gradients left are the ambient layer's blurred
   blobs).
4. At most one torn edge / tape flourish per viewport — texture as accent,
   not wallpaper.
5. Buttons/inputs stay plain and honest (`Button` keeps its spring
   physics, loses the glow ring; `TextInput` gets an underline/ruled-paper
   treatment).

---

## Phase 0 — Foundations

*Everything later depends on this; ~1 PR.*

1. New tokens, fonts, textures, wallpaper swatches in `globals.css` +
   `layout.tsx` (add `next/font` setup).
2. New primitives in `ui.tsx`; `tiltFor` → `src/lib/tilt.ts`.
3. Re-tint ambient layers.
4. Prune dead code: `src/components/motion/Reveal.tsx`,
   `src/components/motion/PageTransition.tsx` (template.tsx reimplements it
   inline), and unused icons in `icons.tsx` (`SparkleIcon`, `ImageIcon`,
   `HourglassIcon`, `EyeIcon`, `ShuffleIcon`).
5. Migrate `Header`/`RoomSwitcher`/`Toast`/`WallpaperPicker` chrome to the
   new language so every page immediately inherits the base look.

## Phase 1 — The radio: cassette deck + station + listen-together

*The centerpiece; ~2 PRs (data layer, then UI).*

### Framing

`/music` becomes the room's radio station. Station name derives from the
room code — `SUNFLOWERS` → **"SUNFLOWERS FM"** — shown as a hand-lettered
station header. The page has two shelves: **Side A — the queue** and
**Side B — dedications**, each styled as a row/stack of labeled cassettes.

### Cassette deck (replaces the vinyl `Player` in `src/app/music/page.tsx`)

An SVG tape deck: cassette body with two spools that spin while playing
(reuse the existing `spin` usage), a `.font-hand` label showing the track
title, and a small tape counter. Below it, the existing `Embed` iframes
(YouTube/Spotify/Apple/SoundCloud) remain the actual audio source —
unchanged mechanically. Dedication cassettes use the partner's handwritten
`NoteCanvas` drawing as the cassette label art.

### Listen-together sync (the real feature)

New shared player state, poll-based like everything else in the app:

- **Schema** (`supabase/schema.sql`, additive): `player_state` table —
  `room_id` PK/FK, `track_id` FK, `started_by` participant, `started_at
  timestamptz`, `updated_at`. RLS service-role-only like the rest.
- **Store** (`src/lib/store/types.ts` + both backends):
  `getPlayerState(roomId)`, `setPlayerState(roomId, trackId,
  participantId)`, `clearPlayerState(roomId)`.
- **API**: `src/app/api/player/route.ts` — GET (current state +
  `serverNow`, following the booth route's clock-offset pattern in
  `src/app/api/booth/[id]/route.ts`), PUT (press play → publish), DELETE
  (stop). DTO in `src/lib/serialize.ts`.
- **UX**: pressing play on any track publishes state. The partner's music
  page (poll tightened 15s → 5s while open) shows a **"⟡ Maya put on
  \<track\> — tune in"** banner; tapping it loads the same embed. The deck
  shows **ON AIR** for both once tuned in. Autoplay policies mean the
  partner must tap — no silent remote-start.
- **Sync accuracy is best-effort and documented as such**: YouTube embeds
  can join at the elapsed offset (`?start=<seconds>` computed from
  `started_at` + server-clock offset); Spotify/Apple/SoundCloud embeds
  can't seek programmatically, so tuning in starts those from the top.
- **Presence tie-in**: a small **on air** chip appears in the `Header`
  next to the room switcher when the partner is broadcasting (piggybacks
  on `SessionDTO` — add `partnerOnAir` alongside `partnerOnline` in
  `sessionToDTO`, `src/lib/serialize.ts`).

### Fixes folded in

- **oEmbed metadata**: `POST /api/tracks` fetches title/artist/thumbnail
  server-side from the provider's no-auth oEmbed endpoint (YouTube,
  Spotify, SoundCloud; Apple where possible), falling back to the typed
  title for `other` links. Kills the manual "Song title" field for
  recognized links and finally feeds the dead `tracks.artist` column.
- **Ownership**: dedications deletable only by their sender (`addedById`
  check in `src/app/api/tracks/[id]/route.ts`); queue tracks stay
  removable by either partner.
- **Storage hygiene**: deleting a track deletes its note PNG.
- **Notifications**: extend `src/lib/notify/events.ts` with
  `dedication_received` and `now_playing`; dispatch from the tracks and
  player routes via the existing `src/lib/notify/notifications.ts` →
  `dispatch.ts` seam.

## Phase 2 — Home as a scrapbook desk

*~1 PR. `src/app/home/page.tsx` is restructured, not just reskinned.*

- **Games cluster**: the 6 uniform gradient tiles become a collage — the
  four games as `Ticket`s at slight tilts in a 2-big + 2-small
  arrangement, Photobooth and Radio as distinct objects (a photo-strip
  tab; a mini cassette). No two tiles identical in shape/size.
- **"Happening now" / "Your turn"**: a ruled-paper note pinned with a
  `TapeStrip`, replacing the card list.
- **Now-playing widget**: when either partner is on air, a small spinning
  cassette with the track label appears near the top, deep-linking to
  `/music`.
- **Memories**: the grid becomes a polaroid wall — `Polaroid` frames,
  `tiltFor` jitter, varied sizes, occasional tape. `GalleryCard.tsx`
  refactors onto the shared primitives.
- **Albums strip** (`AlbumStrip.tsx`): album covers become stacked-photo
  piles with a `.font-hand` title.
- Presence dot moves into `Header`/`RoomSwitcher` (currently presence is
  only consumed by the Photobooth tile gate).
- Fix the stale "the two mini-games" comment (home page ~line 211).
- `/` onboarding restyled as the scrapbook's cover page (same 3-step flow,
  new dress).

## Phase 3 — Games, booth, albums restyle (+ booth fixes)

*~1–2 PRs. Mechanics untouched; surfaces migrate to the new primitives.*

- `challenge/[id]`, `random/[id]`, `knowme/*`, `whereami/*`, `album/[id]`:
  swap `Card` → `Panel`/`Polaroid`, photos get tape/tilt treatment, reveal
  sequences and drawing board keep their logic. `album/[id]` becomes an
  album spread (facing-page layout on wide screens).
- **Booth fixes** while restyling `src/app/booth/[id]/page.tsx`:
  1. Don't request the camera for completed booths — fetch state first,
     only `getUserMedia` when status is `pending`/`live`.
  2. Un-orphan strips: allow either device to composite/upload once both
     columns are complete (first `POST .../strip` wins; `setBoothStrip`
     made idempotent), instead of initiator-only.
  3. Add a `booth_started` notify event so the partner learns about a
     booth even outside the home page's 12s poll.
- Booth chrome styled as a photobooth machine front; strips displayed as
  taped-in photo strips.

## Phase 4 — Cleanup + docs

- Copy adjustments **only where the metaphor changed** (record player →
  radio/cassette wording); no site-wide tone rewrite.
- README: rewrite the feature list (4 games + booth + radio), document
  `player_state`, oEmbed, new notify events, and the design language.
- `.env.example` untouched (no new secrets — oEmbed endpoints are
  keyless).

---

## Verification (each phase)

1. `npm run lint && npm run build` clean.
2. `npm run dev` (zero-config LocalStore) with two browsers (normal +
   private window), two accounts in one room:
   - **Radio**: paste a YouTube link on device A → title/artist auto-fill
     via oEmbed; press play on A → within 5s device B shows the tune-in
     banner; tune in → both decks show ON AIR; stop clears both. Repeat
     with a Spotify link (expect start-from-top). Dedication: B sends with
     lyric + handwritten label → A gets it; A cannot delete B's
     dedication; B can. Deleting a dedication removes its note file from
     `.data/`.
   - **Booth**: full two-device strip; open a completed booth → no camera
     prompt; initiator closes mid-processing → partner's device still
     completes the strip.
   - **Games**: one full round of each of the four games renders correctly
     in the new skin (draw → reveal, prompt → dual reveal, quiz, geo).
   - **Home**: collage layout, polaroid wall, now-playing widget, presence
     dot; all 7 new wallpapers; ambient layers still drift/pause correctly
     (open a modal → paused).
   - **Reduced motion**: `prefers-reduced-motion` still disables ambient
     layers and animations.

## Sequencing & risk notes

- Phases land in order (0 → 4); each is releasable on its own, so the site
  never sits half-reskinned across a deploy.
- Phase 1's data layer (schema + store + API) can merge before its UI —
  additive schema means no migration risk.
- oEmbed calls happen server-side in route handlers; add a short timeout
  and graceful fallback to the typed title so a slow provider never blocks
  adding a track.
- Embed-based playback means sync is "same song, roughly same time", not
  sample-accurate — the ON AIR framing is designed so that's charming
  rather than broken.
