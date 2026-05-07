-- LifeLog initial schema. Idempotent — safe to re-run.

create extension if not exists pgcrypto;

-- ── Users ─────────────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ── Entries: one row per logged entry ─────────────────────────────────
create table if not exists entries (
  id          text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  text        text not null,
  category    text,
  summary     text,
  tags        jsonb,
  timestamp   timestamptz not null,
  source      text,
  created_at  timestamptz not null default now()
);

create index if not exists entries_user_ts_idx
  on entries (user_id, timestamp desc);

-- ── App state: single-row blob per user (taxonomy, future settings) ───
create table if not exists app_state (
  user_id     uuid primary key references users(id) on delete cascade,
  taxonomy    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ── Realtime: NOTIFY on entries / app_state changes ───────────────────
-- Listeners on the 'lifelog_changes' channel get a JSON payload with the
-- affected row's user_id so we can fan out only to that user's SSE clients.
create or replace function notify_lifelog_change() returns trigger as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'table',  TG_TABLE_NAME,
    'op',     TG_OP,
    'user_id', coalesce(new.user_id, old.user_id),
    'row',    to_jsonb(coalesce(new, old))
  );
  perform pg_notify('lifelog_changes', payload::text);
  return coalesce(new, old);
end; $$ language plpgsql;

drop trigger if exists entries_notify on entries;
create trigger entries_notify
  after insert or update or delete on entries
  for each row execute function notify_lifelog_change();

drop trigger if exists app_state_notify on app_state;
create trigger app_state_notify
  after insert or update or delete on app_state
  for each row execute function notify_lifelog_change();
