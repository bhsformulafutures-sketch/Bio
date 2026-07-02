-- Two of Us — database schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Safe to re-run: everything is `if not exists` / additive.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Identity: a person is a phone number + a profile. Verified once,
-- then reused across every room they belong to. The phone is what
-- lets us deliver notifications.
-- ─────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,
  name        text not null,
  avatar      text,                       -- an emoji the person picks
  token       text not null unique,       -- auth token, stored in an httpOnly cookie
  created_at  timestamptz not null default now()
);

create index if not exists users_token_idx on users(token);

-- One-time codes for phone sign-in. Codes are hashed, expire quickly,
-- and lock out after too many wrong tries.
create table if not exists phone_verifications (
  phone       text primary key,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Rooms link exactly two people.
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
-- The app talks to the database exclusively through server-side API
-- routes using the service-role key, so row-level security stays on
-- and locked down (no client ever holds a Supabase key).
-- ─────────────────────────────────────────────────────────────
alter table users enable row level security;
alter table phone_verifications enable row level security;
alter table rooms enable row level security;
alter table participants enable row level security;
alter table challenges enable row level security;
alter table randoms enable row level security;
alter table random_submissions enable row level security;

-- Storage: create a PUBLIC bucket named "photos"
-- (Dashboard → Storage → New bucket → name: photos → Public).
-- Paths: rooms/<room-uuid>/<challenge-uuid>/{original,visible,drawing,merged}.*
--        rooms/<room-uuid>/randoms/<random-uuid>/<participant-uuid>.jpg
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
