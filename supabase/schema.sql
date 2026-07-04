-- The Other Half — database schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Safe to re-run on a fresh database: everything is `if not exists` /
-- additive.
--
-- Identity is device-local: a person picks a nickname + avatar and is
-- issued an opaque token (stored in an httpOnly cookie). There is no
-- email or phone, and no verification codes. If your database still has
-- the old email columns/tables, drop them once:
--   alter table users drop column if exists email;
--   drop table if exists email_verifications;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Identity: a person is a nickname + avatar, keyed by a device token.
-- Reused across every room they belong to.
-- ─────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  avatar      text,                       -- an emoji the person picks
  token       text not null unique,       -- auth token, stored in an httpOnly cookie
  created_at  timestamptz not null default now()
);

create index if not exists users_token_idx on users(token);

-- ─────────────────────────────────────────────────────────────
-- Rooms link exactly two people. The code is chosen by the creator
-- (e.g. SUNFLOWERS), normalized upstream to uppercase A–Z/0–9.
-- ─────────────────────────────────────────────────────────────
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  name        text not null,
  token       text not null unique,
  joined_at   timestamptz not null default now()
);

-- Additive migration for pre-existing databases.
alter table participants add column if not exists user_id uuid references users(id) on delete cascade;

create index if not exists participants_room_idx on participants(room_id);
create index if not exists participants_token_idx on participants(token);
create index if not exists participants_user_idx on participants(user_id);

-- ─────────────────────────────────────────────────────────────
-- Game 1 · Other Half (share half a photo, imagine the rest)
-- ─────────────────────────────────────────────────────────────
create table if not exists challenges (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  creator_id    uuid not null references participants(id) on delete cascade,
  solver_id     uuid references participants(id) on delete set null,
  status        text not null default 'waiting'
                check (status in ('waiting', 'completed')),
  hidden_side   text not null
                check (hidden_side in ('left', 'right', 'top', 'bottom')),
  hidden_ratio  real not null check (hidden_ratio between 0.2 and 0.6),
  width         integer not null,
  height        integer not null,
  original_path text not null,
  visible_path  text not null,
  drawing_path  text,
  merged_path   text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists challenges_room_idx on challenges(room_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Game 2 · Random Challenge (a shared prompt, 24 hours, both snap it)
-- ─────────────────────────────────────────────────────────────
create table if not exists randoms (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  starter_id   uuid not null references participants(id) on delete cascade,
  prompt       text not null,
  category     text not null,
  status       text not null default 'open'
               check (status in ('open', 'completed', 'expired')),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists randoms_room_idx on randoms(room_id, created_at desc);

create table if not exists random_submissions (
  id             uuid primary key default gen_random_uuid(),
  random_id      uuid not null references randoms(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  photo_path     text not null,
  width          integer not null,
  height         integer not null,
  caption        text,
  created_at     timestamptz not null default now(),
  unique (random_id, participant_id)
);

create index if not exists random_submissions_random_idx on random_submissions(random_id);

-- ─────────────────────────────────────────────────────────────
-- Shared scrapbook albums: named collections of memories in a room.
-- A memory is a challenge or a random, referenced loosely by (kind, id)
-- so one album can mix both games.
-- ─────────────────────────────────────────────────────────────
create table if not exists albums (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists albums_room_idx on albums(room_id, updated_at desc);

create table if not exists album_items (
  id        uuid primary key default gen_random_uuid(),
  album_id  uuid not null references albums(id) on delete cascade,
  kind      text not null check (kind in ('challenge', 'random')),
  memory_id uuid not null,
  added_at  timestamptz not null default now(),
  unique (album_id, kind, memory_id)
);

create index if not exists album_items_album_idx on album_items(album_id, added_at desc);

-- ─────────────────────────────────────────────────────────────
-- Browser push subscriptions, one row per browser a participant has
-- enabled notifications on. Deleted when the participant (or room) goes.
-- ─────────────────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  created_at     timestamptz not null default now()
);

create index if not exists push_subscriptions_participant_idx
  on push_subscriptions(participant_id);

-- ─────────────────────────────────────────────────────────────
-- The app talks to the database exclusively through server-side API
-- routes using the service-role key, so row-level security stays on
-- and locked down (no client ever holds a Supabase key).
-- ─────────────────────────────────────────────────────────────
alter table users enable row level security;
alter table rooms enable row level security;
alter table participants enable row level security;
alter table challenges enable row level security;
alter table randoms enable row level security;
alter table random_submissions enable row level security;
alter table albums enable row level security;
alter table album_items enable row level security;
alter table push_subscriptions enable row level security;

-- RLS policies for service role (used by server-side API)
-- Service role can perform all operations
create policy "service_access_rooms" on rooms for all to service_role using (true) with check (true);
create policy "service_access_participants" on participants for all to service_role using (true) with check (true);
create policy "service_access_challenges" on challenges for all to service_role using (true) with check (true);

-- Storage: create a PUBLIC bucket named "photos"
-- (Dashboard → Storage → New bucket → name: photos → Public).
-- Paths: rooms/<room-uuid>/<challenge-uuid>/{original,visible,drawing,merged}.*
--        rooms/<room-uuid>/randoms/<random-uuid>/<participant-uuid>.jpg
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
