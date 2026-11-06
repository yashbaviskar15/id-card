-- ===========================================================================
-- supabase/schema.sql — GENERATED FILE, DO NOT EDIT BY HAND.
-- Built from supabase/migrations/*.sql by scripts/build-schema.mjs.
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/schema.sql
-- ===========================================================================

-- >>> 0001_init.sql >>>
-- ============================================================================
-- 0001_init.sql — Private Digital Identity Card + Document Vault
-- Single-owner app. RLS is enabled AND forced on every table in `public`.
--
-- Design notes
--  * `owner_id = auth.uid()` scopes every policy (IDOR protection).
--  * Privileged DB work (access-code consume, log writes, seeding) lives in
--    SECURITY DEFINER functions whose EXECUTE is revoked from public/anon/
--    authenticated and granted only to service_role.
--  * `slug` is immutable: a trigger raises on any change (QR permanence).
--  * `access_log` / `audit_log` are append-only via trigger, not just policy.
--  * Every column here is personal or document data. No column records, implies
--    or derives anything about where the owner works or what their role is —
--    see tests/fixtures/banned-terms.txt and PLAN.md §20.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles — exactly one row per owner. The slug is permanent.
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null unique references auth.users (id) on delete cascade,
  slug         text not null unique check (slug ~ '^[a-z2-7]{16}$'),
  full_name    text not null check (length(btrim(full_name)) between 1 and 200),
  dob          date,
  address      text check (address is null or length(address) <= 500),
  photo_path   text,
  show_dob     boolean not null default false,
  show_address boolean not null default false,
  show_photo   boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.profiles.slug is
  'Permanent 80-bit base32 slug. Immutable — enforced by guard_slug_immutable(). '
  'The QR payload is derived from this value and must never change.';

-- ----------------------------------------------------------------------------
-- fields — the information manager. Only email/phone may be flagged public.
-- ----------------------------------------------------------------------------

create table if not exists public.fields (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  kind            text not null check (kind in (
                    'email','phone','address','family_contact','emergency_contact',
                    'important_date','note','account_record','custom')),
  label           text check (label is null or length(label) <= 80),
  value           text check (value is null or length(value) <= 2000),
  value_encrypted text,
  is_sensitive    boolean not null default false,
  is_public       boolean not null default false,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Privacy guard: nothing but an email or a phone can ever be exposed to a
  -- visitor, even if a bug or a mistake sets is_public = true.
  constraint fields_public_kind_only check (not is_public or kind in ('email','phone'))
);

comment on column public.fields.value_encrypted is
  'AES-256-GCM envelope v1.<keyId>.<nonce>.<ct>.<tag>; used when is_sensitive.';

-- ----------------------------------------------------------------------------
-- categories — 14 system defaults + unlimited custom.
-- ----------------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  sort       integer not null default 0,
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_owner_name_key
  on public.categories (owner_id, lower(name));

-- ----------------------------------------------------------------------------
-- documents — private Storage objects, metadata only.
-- ----------------------------------------------------------------------------

create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name        text not null check (length(btrim(name)) between 1 and 300),
  storage_path text not null unique,
  mime        text not null,
  size        bigint not null check (size >= 0),
  sha256      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- share_links — expiring, optionally password-protected, revocable.
-- ----------------------------------------------------------------------------

create table if not exists public.share_links (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  document_id      uuid not null references public.documents (id) on delete cascade,
  token_hash       text not null unique,
  password_hash    text,
  expires_at       timestamptz not null,
  max_downloads    integer check (max_downloads is null or max_downloads > 0),
  download_count   integer not null default 0 check (download_count >= 0),
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  last_accessed_at timestamptz
);

-- ----------------------------------------------------------------------------
-- access_grants — one-time access codes. The code itself is never stored.
-- ----------------------------------------------------------------------------

create table if not exists public.access_grants (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  code_hash          text not null unique,
  scope              text not null check (scope in ('contact','full')),
  expires_at         timestamptz not null,
  used_at            timestamptz,
  session_expires_at timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now()
);

comment on column public.access_grants.code_hash is
  'HMAC-SHA256(slug || '':'' || code). The plaintext code never reaches the database.';

-- ----------------------------------------------------------------------------
-- access_log — append-only. Rate-limit windows are derived from it.
-- ----------------------------------------------------------------------------

create table if not exists public.access_log (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  -- Deliberately NO ACTION (not `on delete set null`): the log is append-only,
  -- so an RI-driven UPDATE would be rejected by access_log_append_only anyway.
  -- A grant that is referenced by the audit trail can therefore not be deleted
  -- — it can only be revoked. Deleting the owning auth.users row still works,
  -- because access_log rows are removed by the owner_id cascade first.
  grant_id   uuid references public.access_grants (id),
  slug       text not null,
  outcome    text not null check (outcome in (
               'granted','invalid','expired','used','revoked',
               'rate_limited','locked','session_view','session_end')),
  ip_hash    text,
  user_agent text check (user_agent is null or length(user_agent) <= 200),
  created_at timestamptz not null default now()
);

-- Repair installs created before the FK above was changed away from SET NULL.
alter table public.access_log drop constraint if exists access_log_grant_id_fkey;
alter table public.access_log
  add constraint access_log_grant_id_fkey
  foreign key (grant_id) references public.access_grants (id);

-- ----------------------------------------------------------------------------
-- lockouts / auth_attempts — service-role only bookkeeping.
-- ----------------------------------------------------------------------------

create table if not exists public.lockouts (
  scope        text not null check (scope in ('slug','email','ip','share')),
  key_hash     text not null,
  locked_until timestamptz not null,
  created_at   timestamptz not null default now(),
  primary key (scope, key_hash)
);

create table if not exists public.auth_attempts (
  id         uuid primary key default gen_random_uuid(),
  email_hash text not null,
  ip_hash    text,
  success    boolean not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- audit_log — append-only, identifiers and outcome enums only.
-- ----------------------------------------------------------------------------

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  actor       text not null check (actor in ('owner','visitor','system')),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  detail      jsonb,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- owner_settings — one row per owner, created by the onboarding trigger.
-- ----------------------------------------------------------------------------

create table if not exists public.owner_settings (
  owner_id                 uuid primary key references auth.users (id) on delete cascade,
  default_scope            text not null default 'contact' check (default_scope in ('contact','full')),
  default_validity_minutes integer not null default 5 check (default_validity_minutes between 1 and 30),
  visitor_session_minutes  integer not null default 15 check (visitor_session_minutes between 1 and 60),
  alert_on_new_device      boolean not null default true,
  alert_on_lockout         boolean not null default true,
  totp_enabled             boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- backup_recovery_codes — 2FA recovery codes, stored hashed.
-- ----------------------------------------------------------------------------

create table if not exists public.backup_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index if not exists fields_owner_kind_sort_idx on public.fields (owner_id, kind, sort);
create index if not exists documents_owner_category_name_idx on public.documents (owner_id, category_id, name);
create index if not exists share_links_owner_idx on public.share_links (owner_id, created_at desc);
create index if not exists access_grants_owner_created_idx on public.access_grants (owner_id, created_at desc);
create index if not exists access_log_owner_created_idx on public.access_log (owner_id, created_at desc);
create index if not exists access_log_slug_ip_created_idx on public.access_log (slug, ip_hash, created_at desc);
create index if not exists access_log_slug_outcome_created_idx on public.access_log (slug, outcome, created_at desc);
create index if not exists audit_log_owner_created_idx on public.audit_log (owner_id, created_at desc);
create index if not exists auth_attempts_email_created_idx on public.auth_attempts (email_hash, created_at desc);
create index if not exists auth_attempts_ip_created_idx on public.auth_attempts (ip_hash, created_at desc);
create index if not exists backup_recovery_codes_owner_idx on public.backup_recovery_codes (owner_id);

-- Full-text search for the global search feature.
create index if not exists documents_name_fts_idx on public.documents
  using gin (to_tsvector('simple', coalesce(name, '')));
create index if not exists fields_value_fts_idx on public.fields
  using gin (to_tsvector('simple', coalesce(label, '') || ' ' || coalesce(value, '')));

-- ----------------------------------------------------------------------------
-- Triggers: updated_at
-- ----------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists fields_set_updated_at on public.fields;
create trigger fields_set_updated_at
  before update on public.fields
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists owner_settings_set_updated_at on public.owner_settings;
create trigger owner_settings_set_updated_at
  before update on public.owner_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: slug is immutable (QR permanence invariant 8.5)
-- ----------------------------------------------------------------------------

create or replace function public.guard_slug_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'slug is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_slug_immutable on public.profiles;
create trigger profiles_slug_immutable
  before update on public.profiles
  for each row execute function public.guard_slug_immutable();

-- ----------------------------------------------------------------------------
-- Triggers: append-only logs + system-category protection
-- ----------------------------------------------------------------------------

create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'append-only table: % cannot be modified', tg_table_name
    using errcode = '42501';
end;
$$;

drop trigger if exists access_log_append_only on public.access_log;
create trigger access_log_append_only
  before update or delete on public.access_log
  for each row execute function public.forbid_mutation();

drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();

create or replace function public.guard_system_category()
returns trigger
language plpgsql
as $$
begin
  -- Blocks the application (and any anonymous caller) from deleting a seeded
  -- category. A privileged/admin operation — e.g. cascading from `auth.users`
  -- when the owner account is removed — is still allowed.
  if old.is_system and current_user in ('authenticated', 'anon') then
    raise exception 'system categories cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists categories_guard_system_delete on public.categories;
create trigger categories_guard_system_delete
  before delete on public.categories
  for each row execute function public.guard_system_category();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.profiles              force  row level security;
alter table public.fields                enable row level security;
alter table public.fields                force  row level security;
alter table public.categories            enable row level security;
alter table public.categories            force  row level security;
alter table public.documents             enable row level security;
alter table public.documents             force  row level security;
alter table public.share_links           enable row level security;
alter table public.share_links           force  row level security;
alter table public.access_grants         enable row level security;
alter table public.access_grants         force  row level security;
alter table public.access_log            enable row level security;
alter table public.access_log            force  row level security;
alter table public.lockouts              enable row level security;
alter table public.lockouts              force  row level security;
alter table public.auth_attempts         enable row level security;
alter table public.auth_attempts         force  row level security;
alter table public.audit_log             enable row level security;
alter table public.audit_log             force  row level security;
alter table public.owner_settings        enable row level security;
alter table public.owner_settings        force  row level security;
alter table public.backup_recovery_codes enable row level security;
alter table public.backup_recovery_codes force  row level security;

-- profiles: SELECT/INSERT/UPDATE only. No DELETE — the row is permanent and the
-- kill switch is `is_active`.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- fields
drop policy if exists fields_select_own on public.fields;
create policy fields_select_own on public.fields
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists fields_insert_own on public.fields;
create policy fields_insert_own on public.fields
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists fields_update_own on public.fields;
create policy fields_update_own on public.fields
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists fields_delete_own on public.fields;
create policy fields_delete_own on public.fields
  for delete to authenticated using (owner_id = auth.uid());

-- categories
drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories
  for delete to authenticated using (owner_id = auth.uid());

-- documents
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own on public.documents
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists documents_update_own on public.documents;
create policy documents_update_own on public.documents
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own on public.documents
  for delete to authenticated using (owner_id = auth.uid());

-- share_links
drop policy if exists share_links_select_own on public.share_links;
create policy share_links_select_own on public.share_links
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists share_links_insert_own on public.share_links;
create policy share_links_insert_own on public.share_links
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists share_links_update_own on public.share_links;
create policy share_links_update_own on public.share_links
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists share_links_delete_own on public.share_links;
create policy share_links_delete_own on public.share_links
  for delete to authenticated using (owner_id = auth.uid());

-- access_grants: no DELETE.
drop policy if exists access_grants_select_own on public.access_grants;
create policy access_grants_select_own on public.access_grants
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists access_grants_insert_own on public.access_grants;
create policy access_grants_insert_own on public.access_grants
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists access_grants_update_own on public.access_grants;
create policy access_grants_update_own on public.access_grants
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- access_log: owner may read their own history; writes happen only inside the
-- SECURITY DEFINER function.
drop policy if exists access_log_select_own on public.access_log;
create policy access_log_select_own on public.access_log
  for select to authenticated using (owner_id = auth.uid());

-- audit_log: same shape.
drop policy if exists audit_log_select_own on public.audit_log;
create policy audit_log_select_own on public.audit_log
  for select to authenticated using (owner_id = auth.uid());

-- owner_settings
drop policy if exists owner_settings_select_own on public.owner_settings;
create policy owner_settings_select_own on public.owner_settings
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists owner_settings_insert_own on public.owner_settings;
create policy owner_settings_insert_own on public.owner_settings
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists owner_settings_update_own on public.owner_settings;
create policy owner_settings_update_own on public.owner_settings
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- backup_recovery_codes: metadata only. Writes are service-role only.
drop policy if exists backup_recovery_codes_select_own on public.backup_recovery_codes;
create policy backup_recovery_codes_select_own on public.backup_recovery_codes
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists backup_recovery_codes_delete_own on public.backup_recovery_codes;
create policy backup_recovery_codes_delete_own on public.backup_recovery_codes
  for delete to authenticated using (owner_id = auth.uid());

-- lockouts / auth_attempts intentionally have NO policy: service_role only.

-- ----------------------------------------------------------------------------
-- Private Storage bucket + folder-scoped policies
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_storage_select_own on storage.objects;
create policy documents_storage_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documents_storage_insert_own on storage.objects;
create policy documents_storage_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documents_storage_update_own on storage.objects;
create policy documents_storage_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documents_storage_delete_own on storage.objects;
create policy documents_storage_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- Defensive: the old wide-open helper must not exist or be callable.
-- ----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'public_profile'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Access-log helper (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

create or replace function public.record_access_event(
  p_owner_id   uuid,
  p_grant_id   uuid,
  p_slug       text,
  p_outcome    text,
  p_ip_hash    text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.access_log (owner_id, grant_id, slug, outcome, ip_hash, user_agent)
  values (p_owner_id, p_grant_id, p_slug, p_outcome, p_ip_hash, left(coalesce(p_user_agent, ''), 200));
end;
$$;

-- ----------------------------------------------------------------------------
-- Lockout bookkeeping (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

create or replace function public.check_lockout(
  p_scope    text,
  p_key_hash text
)
returns timestamptz
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select locked_until
  from public.lockouts
  where scope = p_scope and key_hash = p_key_hash and locked_until > now();
$$;

create or replace function public.note_failure(
  p_scope       text,
  p_key_hash    text,
  p_locked_until timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.lockouts (scope, key_hash, locked_until)
  values (p_scope, p_key_hash, p_locked_until)
  on conflict (scope, key_hash)
  do update set locked_until = greatest(public.lockouts.locked_until, excluded.locked_until);
end;
$$;

-- ----------------------------------------------------------------------------
-- consume_access_code — the single atomic, exactly-once verification path.
--   * resolves the active profile by slug
--   * enforces the IP window and the slug lockout (revoking outstanding codes)
--   * locks the matching grant row FOR UPDATE and stamps used_at / session
--   * writes exactly one access_log row
-- ----------------------------------------------------------------------------

create or replace function public.consume_access_code(
  p_slug            text,
  p_code_hash       text,
  p_session_minutes integer,
  p_ip_hash         text default null,
  p_user_agent      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner      uuid;
  v_grant      public.access_grants%rowtype;
  v_ip_fails   integer;
  v_slug_fails integer;
  v_locked     timestamptz;
  v_fail       jsonb;
begin
  select owner_id into v_owner
  from public.profiles
  where slug = p_slug and is_active;

  if v_owner is null then
    -- Unknown slug or disabled profile: identical shape, no information leaked.
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'grant_id', null,
                              'scope', null, 'session_expires_at', null);
  end if;

  select public.check_lockout('slug', p_slug) into v_locked;
  if v_locked is not null then
    perform public.record_access_event(v_owner, null, p_slug, 'locked', p_ip_hash, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'locked', 'grant_id', null,
                              'scope', null, 'session_expires_at', null);
  end if;

  -- Per-IP window: 5 wrong attempts in 10 minutes.
  select count(*) into v_ip_fails
  from public.access_log
  where slug = p_slug and outcome = 'invalid'
    and ip_hash is not null and ip_hash = p_ip_hash
    and created_at > now() - interval '10 minutes';

  if v_ip_fails >= 5 then
    perform public.record_access_event(v_owner, null, p_slug, 'rate_limited', p_ip_hash, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'grant_id', null,
                              'scope', null, 'session_expires_at', null);
  end if;

  -- Per-slug window (any IP): 10 wrong attempts in 15 minutes -> lockout,
  -- revoke every outstanding code.
  select count(*) into v_slug_fails
  from public.access_log
  where slug = p_slug and outcome = 'invalid'
    and created_at > now() - interval '15 minutes';

  if v_slug_fails >= 10 then
    perform public.note_failure('slug', p_slug, now() + interval '15 minutes');
    update public.access_grants
      set revoked_at = now()
      where owner_id = v_owner
        and revoked_at is null
        and used_at is null
        and expires_at > now();
    perform public.record_access_event(v_owner, null, p_slug, 'locked', p_ip_hash, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'locked', 'grant_id', null,
                              'scope', null, 'session_expires_at', null);
  end if;

  select * into v_grant
  from public.access_grants
  where code_hash = p_code_hash and owner_id = v_owner
  for update;

  v_fail := jsonb_build_object('ok', false, 'reason', 'invalid', 'grant_id', null,
                               'scope', null, 'session_expires_at', null);

  if not found then
    perform public.record_access_event(v_owner, null, p_slug, 'invalid', p_ip_hash, p_user_agent);
    return v_fail;
  end if;

  if v_grant.revoked_at is not null then
    perform public.record_access_event(v_owner, v_grant.id, p_slug, 'revoked', p_ip_hash, p_user_agent);
    return jsonb_set(v_fail, '{reason}', '"revoked"');
  end if;

  if v_grant.used_at is not null then
    perform public.record_access_event(v_owner, v_grant.id, p_slug, 'used', p_ip_hash, p_user_agent);
    return jsonb_set(v_fail, '{reason}', '"used"');
  end if;

  if v_grant.expires_at <= now() then
    perform public.record_access_event(v_owner, v_grant.id, p_slug, 'expired', p_ip_hash, p_user_agent);
    return jsonb_set(v_fail, '{reason}', '"expired"');
  end if;

  update public.access_grants
    set used_at = now(),
        session_expires_at = now() + make_interval(mins => greatest(1, least(60, p_session_minutes)))
    where id = v_grant.id
    returning * into v_grant;

  perform public.record_access_event(v_owner, v_grant.id, p_slug, 'granted', p_ip_hash, p_user_agent);

  return jsonb_build_object(
    'ok', true, 'reason', 'granted',
    'grant_id', v_grant.id,
    'scope', v_grant.scope,
    'session_expires_at', v_grant.session_expires_at
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- get_granted_profile — the ONLY way a visitor's data is projected.
--   Returns null unless the grant is used, unrevoked, unexpired and the profile
--   is active. Never returns an is_sensitive row nor a single document.
-- ----------------------------------------------------------------------------

create or replace function public.get_granted_profile(
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
    'full_name', p.full_name,
    'scope', g.scope,
    'photo_path', case when g.scope = 'full' and p.show_photo then p.photo_path else null end,
    'dob',        case when g.scope = 'full' and p.show_dob   then p.dob        else null end,
    'address',    case when g.scope = 'full' and p.show_address then p.address  else null end,
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'email' and f.is_public
    ), '[]'::jsonb),
    'phones', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'phone' and f.is_public
    ), '[]'::jsonb),
    'session_expires_at', g.session_expires_at
  )
  from public.access_grants g
  join public.profiles p on p.owner_id = g.owner_id
  where g.id = p_grant_id
    and p.slug = p_slug
    and p.is_active
    and g.used_at is not null
    and g.revoked_at is null
    and g.session_expires_at > now();
$$;

-- ----------------------------------------------------------------------------
-- seed_categories — 14 idempotent system categories.
-- ----------------------------------------------------------------------------

create or replace function public.seed_categories(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.categories (owner_id, name, sort, is_system)
  select p_owner_id, c.name, c.sort, true
  from (values
    ('Aadhaar Card', 10),
    ('PAN Card', 20),
    ('Passport', 30),
    ('Driving License', 40),
    ('Birth Certificate', 50),
    ('Educational Documents', 60),
    ('Marksheets and Degrees', 70),
    ('Bank Documents', 80),
    ('Financial Documents', 90),
    ('Government Documents', 100),
    ('Medical Documents', 110),
    ('Family Documents', 120),
    ('Personal Photos', 130),
    ('Other', 1000)
  ) as c(name, sort)
  on conflict do nothing;
end;
$$;

-- Onboarding: every new auth user gets settings + the default categories.
create or replace function public.handle_new_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.owner_settings (owner_id) values (new.id)
  on conflict (owner_id) do nothing;
  perform public.seed_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_owner();

-- ----------------------------------------------------------------------------
-- Privileges: definer functions are service-role only.
-- ----------------------------------------------------------------------------

revoke all on function public.record_access_event(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.check_lockout(text, text) from public, anon, authenticated;
revoke all on function public.note_failure(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_access_code(text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.get_granted_profile(uuid, text) from public, anon, authenticated;
revoke all on function public.seed_categories(uuid) from public, anon, authenticated;

grant execute on function public.record_access_event(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.check_lockout(text, text) to service_role;
grant execute on function public.note_failure(text, text, timestamptz) to service_role;
grant execute on function public.consume_access_code(text, text, integer, text, text) to service_role;
grant execute on function public.get_granted_profile(uuid, text) to service_role;
grant execute on function public.seed_categories(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- Anonymous lockdown.
--
-- Visitors never touch the database directly — the access gate runs entirely on
-- the server with the service-role client, and the profile is projected only by
-- get_granted_profile(). Supabase grants `anon` SELECT on new public tables by
-- default, which would leave Row Level Security returning zero rows instead of
-- denying the request outright. Revoke the grants so an anonymous caller is
-- refused before RLS is even consulted, and make it deny-by-default for objects
-- added in later migrations.
-- ----------------------------------------------------------------------------

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- Trigger-only helpers are never callable by an API role.
revoke all on function public.set_updated_at()            from public, anon, authenticated;
revoke all on function public.forbid_mutation()           from public, anon, authenticated;
revoke all on function public.guard_slug_immutable()      from public, anon, authenticated;
revoke all on function public.guard_system_category()     from public, anon, authenticated;
revoke all on function public.handle_new_owner()          from public, anon, authenticated;
revoke all on function public.rls_auto_enable()           from public, anon, authenticated;

-- >>> 0002_visitor_documents.sql >>>
-- ----------------------------------------------------------------------------
-- 0002 — Visitor document sharing.
--
-- The one permanent QR code never changes. Instead, the owner decides, per
-- hand-out, whether the visitor may also open the documents that have been
-- flagged as shareable. Two columns make that possible and two functions
-- project the result; nothing else reads those columns.
--
--   * documents.is_shared         — owner opt-in, per document, default off.
--   * access_grants.include_documents — per hand-out, default off.
--
-- Both default to false, so an existing profile and every previously issued
-- code keep behaving exactly as before.
-- ----------------------------------------------------------------------------

alter table public.documents
  add column if not exists is_shared boolean not null default false;

alter table public.access_grants
  add column if not exists include_documents boolean not null default false;

comment on column public.documents.is_shared is
  'Owner opt-in. Only a shared document can reach a visitor, and only through a grant that include_documents.';
comment on column public.access_grants.include_documents is
  'When true, the visitor session may also open the owner''s shared documents.';

-- Only shared documents are ever candidates for a visitor listing.
create index if not exists documents_owner_shared_idx
  on public.documents (owner_id, created_at desc)
  where is_shared;

-- ----------------------------------------------------------------------------
-- get_granted_profile — the ONLY way a visitor's data is projected.
--   Now also returns the owner's shared documents (metadata only, never a
--   storage path) when this grant opted in. Returns null unless the grant is
--   used, unrevoked, unexpired and the profile is active.
-- ----------------------------------------------------------------------------

create or replace function public.get_granted_profile(
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
    'full_name', p.full_name,
    'scope', g.scope,
    'photo_path', case when g.scope = 'full' and p.show_photo then p.photo_path else null end,
    'dob',        case when g.scope = 'full' and p.show_dob   then p.dob        else null end,
    'address',    case when g.scope = 'full' and p.show_address then p.address  else null end,
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'email' and f.is_public
    ), '[]'::jsonb),
    'phones', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'phone' and f.is_public
    ), '[]'::jsonb),
    -- Metadata only: never the storage path, never a signed URL.
    'documents', case when g.include_documents then coalesce((
      select jsonb_agg(
               jsonb_build_object('id', d.id, 'name', d.name, 'mime', d.mime, 'size', d.size)
               order by d.created_at desc
             )
      from public.documents d
      where d.owner_id = p.owner_id and d.is_shared
    ), '[]'::jsonb) else '[]'::jsonb end,
    'can_view_documents', g.include_documents,
    'session_expires_at', g.session_expires_at
  )
  from public.access_grants g
  join public.profiles p on p.owner_id = g.owner_id
  where g.id = p_grant_id
    and p.slug = p_slug
    and p.is_active
    and g.used_at is not null
    and g.revoked_at is null
    and g.session_expires_at > now();
$$;

-- ----------------------------------------------------------------------------
-- get_granted_document — resolves one shared document for a live visitor
--   session. Returns the storage path only when the grant opted in, the
--   document is shared, and the grant is still valid. Otherwise null.
-- ----------------------------------------------------------------------------

create or replace function public.get_granted_document(
  p_grant_id    uuid,
  p_slug        text,
  p_document_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'storage_path', d.storage_path,
    'name', d.name,
    'mime', d.mime
  )
  from public.access_grants g
  join public.profiles p on p.owner_id = g.owner_id
  join public.documents d on d.owner_id = g.owner_id and d.id = p_document_id
  where g.id = p_grant_id
    and p.slug = p_slug
    and p.is_active
    and g.include_documents
    and g.used_at is not null
    and g.revoked_at is null
    and g.session_expires_at > now()
    and d.is_shared;
$$;

-- ----------------------------------------------------------------------------
-- Privileges: definer functions stay service-role only.
-- ----------------------------------------------------------------------------

revoke all on function public.get_granted_profile(uuid, text) from public, anon, authenticated;
revoke all on function public.get_granted_document(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.get_granted_profile(uuid, text) to service_role;
grant execute on function public.get_granted_document(uuid, text, uuid) to service_role;
