-- ============================================================================
-- 0013_private_photos.sql
--
-- Private photo album, reachable from the same public link as the profile
-- (/p/<slug>). Two independent objects make it work:
--
--   * private_photos — one owner-uploaded photo. Only the metadata (name, mime,
--     size) lives here; the bytes live in the private `documents` bucket,
--     encrypted at rest (AES-256-GCM, app keyring) so raw storage is useless.
--   * owner_secrets — service-role-only. Holds the salted password hash that
--     gates the album and the on/off switch. Deliberately has NO row level
--     security policy, so neither anon nor an authenticated client can read it.
--
-- A visitor opens the album with one of the owner's one-time access codes AND
-- the owner's private-photo password. The album is projected only through
-- SECURITY DEFINER functions, never from a client query, and only while the
-- section is enabled and the visitor session is still valid.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lockouts — widen the scope set for the album unlock limiter.
--    (Mirrors 0010, which added 'action'; the dropped name is the inline one
--    from 0001 in case an install renamed it.)
-- ----------------------------------------------------------------------------
alter table public.lockouts drop constraint if exists lockouts_scope_check;
alter table public.lockouts
  add constraint lockouts_scope_check
  check (scope in ('slug', 'email', 'ip', 'share', 'action', 'photo'));

-- ----------------------------------------------------------------------------
-- 2. owner_secrets — password hash + section switch. Service role only.
-- ----------------------------------------------------------------------------
create table if not exists public.owner_secrets (
  owner_id               uuid primary key references auth.users (id) on delete cascade,
  photo_password_hash    text,
  photo_password_set_at  timestamptz,
  private_photos_enabled boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on column public.owner_secrets.photo_password_hash is
  'Argon2id hash of the private-photo password. Never leaves the server role.';

alter table public.owner_secrets enable row level security;
alter table public.owner_secrets force  row level security;

-- Deny by default: no policy is created, and the default privileges from 0001
-- do not cover tables added later, so anon/authenticated are refused outright.
revoke all on public.owner_secrets from anon, authenticated;
revoke all on public.owner_secrets from public;
-- Only the server role (password verification in the app layer) may touch it.
grant all on public.owner_secrets to service_role;

drop trigger if exists owner_secrets_set_updated_at on public.owner_secrets;
create trigger owner_secrets_set_updated_at
  before update on public.owner_secrets
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. private_photos — metadata for owner-uploaded, encrypted photo objects.
-- ----------------------------------------------------------------------------
create table if not exists public.private_photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 300),
  storage_path text not null unique,
  mime         text not null,
  size         bigint not null check (size >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists private_photos_owner_created_idx
  on public.private_photos (owner_id, created_at desc);

alter table public.private_photos enable row level security;
alter table public.private_photos force  row level security;

drop policy if exists private_photos_select_own on public.private_photos;
create policy private_photos_select_own on public.private_photos
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists private_photos_insert_own on public.private_photos;
create policy private_photos_insert_own on public.private_photos
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists private_photos_update_own on public.private_photos;
create policy private_photos_update_own on public.private_photos
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists private_photos_delete_own on public.private_photos;
create policy private_photos_delete_own on public.private_photos
  for delete to authenticated using (owner_id = auth.uid());

drop trigger if exists private_photos_set_updated_at on public.private_photos;
create trigger private_photos_set_updated_at
  before update on public.private_photos
  for each row execute function public.set_updated_at();

-- The owner manages rows through the user (RLS) client; the server role reads
-- storage paths when it streams an encrypted photo. anon is refused outright.
revoke all on public.private_photos from anon;
grant select, insert, update, delete on public.private_photos to authenticated;
grant all on public.private_photos to service_role;

-- ----------------------------------------------------------------------------
-- 4. get_granted_photos — metadata list for a live visitor session.
--    Returns null (no row) unless the grant is used, unrevoked, unexpired, the
--    profile is active and the album is switched on. Never a storage path.
-- ----------------------------------------------------------------------------
create or replace function public.get_granted_photos(
  p_grant_id uuid,
  p_slug     text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', ph.id,
                 'name', ph.name,
                 'mime', ph.mime,
                 'size', ph.size,
                 'created_at', ph.created_at
               )
               order by ph.created_at desc
             )
      from public.private_photos ph
      where ph.owner_id = g.owner_id
    ), '[]'::jsonb),
    'session_expires_at', g.session_expires_at,
    'server_now', now()
  )
  from public.access_grants g
  join public.profiles p on p.owner_id = g.owner_id
  join public.owner_secrets s on s.owner_id = g.owner_id
  where g.id = p_grant_id
    and p.slug = p_slug
    and p.is_active
    and s.private_photos_enabled
    and g.used_at is not null
    and g.revoked_at is null
    and g.session_expires_at > now();
$$;

-- ----------------------------------------------------------------------------
-- 5. get_granted_photo — resolves one album photo for a live visitor session.
--    Returns the storage path only under exactly the same conditions as the
--    listing above; otherwise null.
-- ----------------------------------------------------------------------------
create or replace function public.get_granted_photo(
  p_grant_id   uuid,
  p_slug       text,
  p_photo_id   uuid
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'owner_id', g.owner_id,
    'storage_path', ph.storage_path,
    'mime', ph.mime,
    'name', ph.name
  )
  from public.access_grants g
  join public.profiles p on p.owner_id = g.owner_id
  join public.owner_secrets s on s.owner_id = g.owner_id
  join public.private_photos ph on ph.owner_id = g.owner_id and ph.id = p_photo_id
  where g.id = p_grant_id
    and p.slug = p_slug
    and p.is_active
    and s.private_photos_enabled
    and g.used_at is not null
    and g.revoked_at is null
    and g.session_expires_at > now();
$$;

-- ----------------------------------------------------------------------------
-- 6. Privileges: definer functions stay service-role only.
-- ----------------------------------------------------------------------------
revoke all on function public.get_granted_photos(uuid, text) from public, anon, authenticated;
revoke all on function public.get_granted_photo(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.get_granted_photos(uuid, text) to service_role;
grant execute on function public.get_granted_photo(uuid, text, uuid) to service_role;
