-- Other Half — database schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- First delete old tables: drop table if exists challenges cascade; drop table if exists participants cascade; drop table if exists rooms cascade;

create extension if not exists pgcrypto;

-- Users: device identities with avatar/nickname
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  avatar      text,
  token       text not null unique,
  created_at  timestamptz not null default now()
);

-- Rooms: shared spaces where two people meet
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_at  timestamptz not null default now()
);

-- Participants: people in a room (the two of you)
create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  name        text not null,
  token       text not null unique,
  joined_at   timestamptz not null default now()
);

-- Challenges: photo guessing games
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

-- Random challenges: prompt-based games
create table if not exists randoms (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  starter_id  uuid not null references participants(id) on delete cascade,
  prompt      text not null,
  category    text not null,
  status      text not null default 'open'
              check (status in ('open', 'completed', 'expired')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

-- Random submissions: photo responses to prompts
create table if not exists random_submissions (
  id            uuid primary key default gen_random_uuid(),
  random_id     uuid not null references randoms(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  photo_path    text not null,
  width         integer not null,
  height        integer not null,
  caption       text,
  created_at    timestamptz not null default now()
);

-- Albums: named collections of memories
create table if not exists albums (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Album items: memories (challenges or randoms) filed inside albums
create table if not exists album_items (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references albums(id) on delete cascade,
  kind        text not null check (kind in ('challenge', 'random')),
  memory_id   uuid not null,
  added_at    timestamptz not null default now()
);

-- Web push subscriptions for notifications
create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid not null references participants(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  created_at      timestamptz not null default now()
);

-- Indexes for performance
create index if not exists users_token_idx on users(token);
create index if not exists participants_room_idx on participants(room_id);
create index if not exists participants_user_idx on participants(user_id);
create index if not exists participants_token_idx on participants(token);
create index if not exists challenges_room_idx on challenges(room_id, created_at desc);
create index if not exists challenges_creator_idx on challenges(creator_id);
create index if not exists randoms_room_idx on randoms(room_id, created_at desc);
create index if not exists random_submissions_random_idx on random_submissions(random_id);
create index if not exists albums_room_idx on albums(room_id);
create index if not exists album_items_album_idx on album_items(album_id);
create unique index if not exists album_items_unique_idx on album_items(album_id, kind, memory_id);
create index if not exists push_subscriptions_participant_idx on push_subscriptions(participant_id);

-- Enable Row Level Security
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
create policy if not exists "service_access_users" on users for all to service_role using (true) with check (true);
create policy if not exists "service_access_rooms" on rooms for all to service_role using (true) with check (true);
create policy if not exists "service_access_participants" on participants for all to service_role using (true) with check (true);
create policy if not exists "service_access_challenges" on challenges for all to service_role using (true) with check (true);
create policy if not exists "service_access_randoms" on randoms for all to service_role using (true) with check (true);
create policy if not exists "service_access_random_submissions" on random_submissions for all to service_role using (true) with check (true);
create policy if not exists "service_access_albums" on albums for all to service_role using (true) with check (true);
create policy if not exists "service_access_album_items" on album_items for all to service_role using (true) with check (true);
create policy if not exists "service_access_push_subscriptions" on push_subscriptions for all to service_role using (true) with check (true);

-- Storage: create a PUBLIC bucket named "photos"
-- (Dashboard → Storage → New bucket → name: photos → Public).
-- Object paths are rooms/<room-uuid>/<challenge-uuid>/{original,visible,drawing,merged}.*
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
