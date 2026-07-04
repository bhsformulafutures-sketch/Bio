-- Other Half — database schema
-- Run this in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  name        text not null,
  token       text not null unique,
  joined_at   timestamptz not null default now()
);

create index if not exists participants_room_idx on participants(room_id);
create index if not exists participants_token_idx on participants(token);

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

-- The app talks to the database exclusively through server-side API routes
-- using the service-role key, so row-level security stays locked down:
alter table rooms enable row level security;
alter table participants enable row level security;
alter table challenges enable row level security;

-- RLS policies for service role (used by server-side API)
-- Service role can perform all operations
create policy "service_access_rooms" on rooms for all to service_role using (true) with check (true);
create policy "service_access_participants" on participants for all to service_role using (true) with check (true);
create policy "service_access_challenges" on challenges for all to service_role using (true) with check (true);

-- Storage: create a PUBLIC bucket named "photos"
-- (Dashboard → Storage → New bucket → name: photos → Public).
-- Object paths are rooms/<room-uuid>/<challenge-uuid>/{original,visible,drawing,merged}.*
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
