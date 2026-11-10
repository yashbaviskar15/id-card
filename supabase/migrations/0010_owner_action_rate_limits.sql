-- ============================================================================
-- 0010_owner_action_rate_limits.sql
--
-- Throttling for authenticated mutation actions. 0001 already ships the
-- `lockouts` table used by the login / access-code / share-password limiters;
-- this migration widens its scope enum with 'action' and adds a small
-- service-role-only event log so a per-owner sliding window can be counted.
--
-- Both objects are bookkeeping only: no policy is created for either, so only
-- the service role can read or write them. The application helper
-- (guardOwnerAction in src/lib/rate-limit.ts) fails open, so an unapplied
-- migration degrades to "no throttle", never to a broken dashboard.
-- ============================================================================

-- 1. Widen the lockout scope set (the inline check from 0001 is named
--    lockouts_scope_check, but drop defensively in case an install renamed it).
alter table public.lockouts drop constraint if exists lockouts_scope_check;
alter table public.lockouts
  add constraint lockouts_scope_check check (scope in ('slug', 'email', 'ip', 'share', 'action'));

-- 2. One row per accepted owner action; the sliding window is derived from it.
create table if not exists public.owner_action_events (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  action     text not null check (length(action) between 1 and 60),
  created_at timestamptz not null default now()
);

create index if not exists owner_action_events_owner_action_created_idx
  on public.owner_action_events (owner_id, action, created_at desc);

alter table public.owner_action_events enable row level security;
alter table public.owner_action_events force  row level security;

-- Deny-by-default: anon/authenticated are refused before RLS is consulted, and
-- the default privileges set in 0001 do not cover tables created later.
revoke all on public.owner_action_events from anon, authenticated;
revoke all on public.owner_action_events from public;
