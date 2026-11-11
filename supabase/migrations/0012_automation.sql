-- ============================================================================
-- 0012_automation.sql
--
-- Owner automation, added to cut down recurring manual work:
--   * quick-access presets + remembered "last settings" (M-1)
--   * saved share-link defaults (M-2)
--   * a scheduled housekeeping function that retires expired codes and links
--     and purges old rate-limit bookkeeping (M-3)
--   * a private, service-role-only bucket for scheduled encrypted backups (M-4)
--   * an access-alert preference used by the "grant used" notification (M-6)
--
-- Every object here is additive and fail-safe: the application reads a missing
-- column as "unset" and never depends on the cron jobs having run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. owner_settings — new automation columns
-- ----------------------------------------------------------------------------

alter table public.owner_settings
  add column if not exists quick_presets jsonb not null default '[]'::jsonb,
  add column if not exists last_scope text,
  add column if not exists last_validity_minutes integer,
  add column if not exists last_include_documents boolean not null default false,
  add column if not exists share_default_expiry_minutes integer not null default 1440,
  add column if not exists share_default_max_downloads integer,
  add column if not exists alert_on_access boolean not null default true;

-- quick_presets: an array of at most 12 {id,label,scope,validity_minutes,
-- include_documents} objects. Validated here so a malformed client value can
-- never be stored.
alter table public.owner_settings
  drop constraint if exists owner_settings_quick_presets_check;
alter table public.owner_settings
  add constraint owner_settings_quick_presets_check
  check (jsonb_typeof(quick_presets) = 'array' and jsonb_array_length(quick_presets) <= 12);

alter table public.owner_settings
  drop constraint if exists owner_settings_last_scope_check;
alter table public.owner_settings
  add constraint owner_settings_last_scope_check
  check (last_scope is null or last_scope in ('contact', 'full'));

alter table public.owner_settings
  drop constraint if exists owner_settings_last_validity_check;
alter table public.owner_settings
  add constraint owner_settings_last_validity_check
  check (last_validity_minutes is null or last_validity_minutes between 1 and 30);

alter table public.owner_settings
  drop constraint if exists owner_settings_share_expiry_check;
alter table public.owner_settings
  add constraint owner_settings_share_expiry_check
  check (share_default_expiry_minutes between 5 and 43200);

alter table public.owner_settings
  drop constraint if exists owner_settings_share_max_downloads_check;
alter table public.owner_settings
  add constraint owner_settings_share_max_downloads_check
  check (share_default_max_downloads is null or share_default_max_downloads between 1 and 1000);

-- ----------------------------------------------------------------------------
-- 2. Housekeeping — retires stale security records in one transaction.
--
-- Service-role only. Called by the daily cleanup job (/api/cron/cleanup).
-- The access-grant update relies on guard_access_grant_owner_update() letting
-- the service role through, which is exactly how the access-code lockout path
-- already revokes outstanding codes.
-- ----------------------------------------------------------------------------

create or replace function public.expire_stale_security_records()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grants    integer;
  v_links     integer;
  v_lockouts  integer;
  v_attempts  integer;
  v_actions   integer;
begin
  -- Unused codes whose validity window has long passed are revoked so the
  -- dashboard never shows a stale "active" code.
  update public.access_grants
     set revoked_at = now()
   where revoked_at is null
     and used_at is null
     and expires_at < now() - interval '1 hour';
  get diagnostics v_grants = row_count;

  -- Non-revoked links past their expiry are stamped revoked so the list status
  -- matches the record rather than being computed only at read time.
  update public.share_links
     set revoked_at = now()
   where revoked_at is null
     and expires_at < now() - interval '1 hour';
  get diagnostics v_links = row_count;

  delete from public.lockouts where locked_until < now() - interval '1 day';
  get diagnostics v_lockouts = row_count;

  delete from public.auth_attempts where created_at < now() - interval '7 days';
  get diagnostics v_attempts = row_count;

  delete from public.owner_action_events where created_at < now() - interval '7 days';
  get diagnostics v_actions = row_count;

  return jsonb_build_object(
    'expired_grants', v_grants,
    'expired_share_links', v_links,
    'cleared_lockouts', v_lockouts,
    'purged_auth_attempts', v_attempts,
    'purged_action_events', v_actions,
    'ran_at', now()
  );
end;
$$;

revoke all on function public.expire_stale_security_records() from public, anon, authenticated;
grant execute on function public.expire_stale_security_records() to service_role;

-- ----------------------------------------------------------------------------
-- 3. Private bucket for scheduled encrypted backups.
--
-- Deliberately has NO storage.objects policy: only the service role (which
-- bypasses RLS) can read or write it, so a backup bundle can never be listed
-- or downloaded by a browser session.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
