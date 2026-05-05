-- Run this once in Supabase SQL Editor (Project → SQL Editor → New query).
-- It creates two tables, enables Row Level Security, and turns on realtime.

-- ── Entries: one row per logged entry ──────────────────────────────────
create table if not exists public.entries (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null,
  category    text,
  summary     text,
  tags        jsonb,
  timestamp   timestamptz not null,
  source      text,
  created_at  timestamptz default now()
);

create index if not exists entries_user_ts_idx
  on public.entries (user_id, timestamp desc);

-- ── App state: single-row blob per user (taxonomy, future settings) ───
create table if not exists public.app_state (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  taxonomy    jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- ── Row-level security ────────────────────────────────────────────────
alter table public.entries   enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own state" on public.app_state;
create policy "own state" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Realtime: stream INSERT/UPDATE/DELETE to subscribed clients ───────
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.app_state;
