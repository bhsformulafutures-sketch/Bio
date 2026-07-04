# UI / Motion / Room-System Overhaul — Handoff

Working branch: **`claude/ui-motion-room-overhaul-t7sqs4`**
Project: **The Other Half** (Next.js 15 · React 19 · Tailwind 4 · Supabase/local store)

> ⚠️ **Base-branch note (important).** This branch was originally (mistakenly)
> cut from `claude/photo-imagination-game-canp5o`. It has since been **re-cut
> from `claude/verify-site-deployment-t4ocbm`** (commit `e3d7d91`), which is the
> **active** project — it has the email-OTP auth, the `src/lib/notify/*` email
> system, and the Random Challenge game. If you ever re-base again, base on
> `verify-site-deployment-t4ocbm`, NOT the default HEAD.

## Delivery decisions (from the user)
1. **Motion:** use **Framer Motion** (`motion` package) — installed.
2. **Avatars:** emoji / illustration **presets** (no uploads).
3. **Delivery:** was "phased with check-ins", now **"push all phases, no waiting"**.
4. **Albums cover:** **auto** = most-recently-added memory's image.
5. **Preserve the "Dusk & Blush" palette** (rose `#e8607d` + periwinkle dusk). Do NOT change colors.

## Phase status
- ✅ **Phase 1 — Motion foundation** (committed `43f10f6`, pushed)
- ✅ **Phase 2 — Interactive component polish** (committed `c70cb3a`, pushed)
- ✅ **Phase 3 — Albums** (this commit — see below)
- ⬜ **Phase 4 — Room & identity system** (NOT started)
- ⬜ **Phase 5 — Notifications scaffolding** (NOT started)
- ⬜ **Phase 6 — Final polish + verify** (NOT started)

---

## What Phase 1 + 2 added (already on branch)
- `src/lib/motion.ts` — shared springs/easing/tweens/variants (the single motion language).
- `src/components/motion/`:
  - `MotionProvider.tsx` — `MotionConfig reducedMotion="user"` (wraps app in `layout.tsx`).
  - `AmbientBackground.tsx` — drifting rose/periwinkle blobs + gold/rose twinkles (living interface). Mounted in `layout.tsx` behind content.
  - `Reveal.tsx` — `Reveal` / `RevealGroup` / `RevealItem` scroll-stagger.
  - `BlurImage.tsx` — blur-to-sharp image loader. **Sizing gotcha:** for dynamic aspect ratios pass `className="block w-full"` + `style={{ aspectRatio }}`; for fixed boxes give the wrapper the size via `wrapperClassName` (e.g. `size-16`) and use `className="h-full w-full object-cover"`.
  - `PageTransition.tsx` + `Pressable.tsx` (shared hover-lift/spring press for links/rows/tiles).
- `src/app/template.tsx` — global route crossfade.
- `src/components/ui.tsx` — `Button`/`Card` retrofit with spring press/hover (kept `dusk` variant, `Avatar`, `Skeleton`, `Badge`). `Card` gained `interactive` + `breathe` props.
- `src/app/globals.css` — ambient keyframes (`drift`, `gradient-pan`, `glow`, `twinkle`), `.glass`, `.ambient-layer`, ambient hidden under reduced-motion.
- `GalleryCard.tsx` + `RandomCard.tsx` — scrapbook tilt, `BlurImage`, spring hover. Exported `tiltFor(index)`.
- Home/new/challenge/random pages — blur-to-sharp images + `Pressable` on interactive rows/tiles; Header room chip spring press.

## What Phase 3 added (Albums) — this commit
Data model + full CRUD across the stack, plus UI.
- **Store (`src/lib/store/types.ts`)**: `AlbumRecord`, `AlbumItemRecord`, `MemoryKind = "challenge"|"random"`, and `Store` methods: `listAlbums`, `getAlbum`, `createAlbum`, `renameAlbum`, `deleteAlbum`, `listAlbumItems`, `listAlbumItemsForRoom`, `addAlbumItem`, `removeAlbumItem`.
- **`local.ts`** and **`supabase.ts`** both implement them. `local.ts` `deleteRoom` also purges albums.
- **`supabase/schema.sql`**: `albums` + `album_items` tables (FK cascade from rooms/albums), RLS enabled. **Action for prod: run the updated schema.sql in Supabase.**
- **`src/lib/serialize.ts`**: `memoryKey(kind,id)`, `albumsToDTO(roomId)` (computes count + auto cover), `albumRecordToDTO`, `normalizeAlbumName`.
- **`src/lib/types.ts`**: `AlbumDTO { id, name, count, coverUrl, createdAt, itemKeys[] }` (itemKeys like `"challenge:<id>"`).
- **API routes**: `GET/POST /api/albums`, `GET/PATCH/DELETE /api/albums/[id]`, `POST/DELETE /api/albums/[id]/items` (body `{ kind, itemId }`).
- **Client (`src/lib/api.ts`)**: `listAlbums`, `getAlbum`, `createAlbum`, `renameAlbum`, `deleteAlbum`, `addToAlbum`, `removeFromAlbum`.
- **UI**:
  - `src/components/AlbumStrip.tsx` — horizontal scrapbook shelf on home (cover, count, tilt) + inline "New album" tile. Shown on home only when memories exist (above "Memories 💛").
  - `src/app/albums/[id]/page.tsx` — album detail: inline rename, two-tap delete, "＋ Add memories" mode (tap thumbnails to toggle membership, optimistic), view mode renders `GalleryCard`/`RandomCard` in the album.
- **Albums hold BOTH game types** (completed Other-Half challenges + non-open Random Challenges).

### Phase 3 verification status
`tsc --noEmit` clean, `npm run build` clean (all `/albums/*` routes compile). Full **browser** click-through of albums was **not** completed (local dev-server port kept colliding with stale servers during the session). Recommended first step next chat: seed a memory and click through albums (see "How to run/verify" below).

---

## Remaining work

### Phase 4 — Room & identity system (replace auth)
Goal: **remove email/OTP**, use **nickname + emoji avatar + custom room code**, persist locally, lock at 2.
- Current auth lives in: `src/app/api/auth/{request-code,verify,state,logout}`, `src/lib/auth/{email,otp}.ts`, onboarding `src/app/page.tsx` (steps: welcome→email→code→profile→room), `src/lib/session.ts` (`AUTH_COOKIE oh_uid`, `ROOM_COOKIE oh_room`), `UserRecord.email`.
- Plan:
  - New onboarding flow: **nickname + avatar → create/join room**. No email step.
  - Make `UserRecord.email` nullable (or drop it). `createUser` currently `(email, name, avatar)` — add a no-email path (e.g. `createUserLightweight(name, avatar)` returning a user + token; keep token cookie for device persistence). Update `serialize.userToDTO` (drop `emailHint`) and `AuthStateDTO`.
  - **Custom room codes:** add `createRoom(userId, name, code)` (validate 4–20 chars, case-insensitive → store UPPER, unique). `newRoomCode()` stays as a fallback/suggestion generator. Update `/api/room` to accept a chosen code; keep join-by-code + the existing 2-person lock (already enforced).
  - Delete/neutralize `request-code`/`verify` routes and `lib/auth/*` email bits (or keep files but stop using — Phase 5 also removes notify email).
  - Avatar preset list already exists via `/api/profile` (`api.getAvatars`); reuse for the picker.
  - Persist identity locally: the httpOnly user-token cookie already does this — keep it (1-year maxAge). Onboarding should resume to `/home` when the cookie resolves (see `authState`).

### Phase 5 — Notifications (remove email, scaffold push)
- **Remove** `src/lib/notify/providers/resend.ts` + the email send path; strip `notifyChallengeSent/Completed`, `notifyRandomStarted/Completed`, `notifyDailyAvailable` email calls (called from `api/challenges/route.ts`, the complete route, and `api/randoms/*`). Grep `notify`.
- **Scaffold browser push** with clear integration points (do NOT ship broken push):
  - `public/sw.js` service worker (push + notificationclick handlers).
  - `src/lib/push/` — types + a `sendPush(userId, payload)` stub and event helpers for the 4 events: new challenge received, challenge completed, daily challenge available, deadline reminder.
  - `POST /api/push/subscribe` storing a `PushSubscriptionRecord` per user (add store methods + table/JSON).
  - Client hook to request permission + subscribe (VAPID public key via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; private via env). Leave `web-push` wiring as a documented integration point (env keys), returning no-op when unconfigured — mirror how the email provider degraded gracefully.
  - Update `.env.example` + README with the VAPID/integration notes.

### Phase 6 — Final polish + verify
- Sweep spacing/typography/responsiveness; remove any placeholder styling; unify remaining ad-hoc animations onto `src/lib/motion.ts`.
- Verify every existing feature still works (onboard → create/join room → Other Half full round incl. reveal → Random Challenge round → gallery → albums → room switch/delete → sign out).
- `npm run build` must stay green.

---

## How to run / verify (dev, zero-config local store)
```bash
npm install
PORT=3000 npm run start   # after: npm run build   (or: npm run dev)
```
- **Kill stale servers first** (they caused port collisions this session):
  `for p in 3000 3100 3200; do pid=$(fuser $p/tcp 2>/dev/null|tr -d ' '); [ -n "$pid" ] && kill -9 $pid; done`
- **Playwright** is pre-installed at `/opt/node22/lib/node_modules/playwright`; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Import via absolute path in a `.cjs`.
- **Seed a memory** (to see albums) — write `.data/db.json` with a user (token `tok-user-1`), a room, a participant, and a few completed `challenges` (each with a `visible.jpg` under `.data/files/rooms/<rid>/<cid>/`), then set cookies `oh_uid=<user.token>` and `oh_room=<room.id>` via Playwright `context.addCookies` and open `/home`. (A 1×1 JPEG base64 is fine for the image bytes.) `.data/` is gitignored.
- Onboarding also works live: Get started → email → **dev OTP is returned in the `/api/auth/request-code` JSON and shown in a toast** (email isn't "live" locally) → profile → room.

## Commits so far on branch
- `43f10f6` Phase 1: motion foundation & living interface
- `c70cb3a` Phase 2: interactive component polish
- `<this>`  Phase 3: albums (data model + API + UI)
- Local safety branch `backup-phase1-wrongbase` holds the original wrong-base Phase 1 (ignore).
