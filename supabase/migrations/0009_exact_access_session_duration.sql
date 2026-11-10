-- The duration selected when issuing a code also governs the visitor session.
alter table public.access_grants
  add column if not exists session_duration_minutes integer not null default 15
  check (session_duration_minutes between 1 and 60);

update public.access_grants
set session_duration_minutes = greatest(
  1,
  least(30, round(extract(epoch from (expires_at - created_at)) / 60)::integer)
);

create or replace function public.guard_access_grant_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is distinct from old.owner_id
    or new.owner_id is distinct from old.owner_id
    or new.code_hash is distinct from old.code_hash
    or new.scope is distinct from old.scope
    or new.include_documents is distinct from old.include_documents
    or new.expires_at is distinct from old.expires_at
    or new.used_at is distinct from old.used_at
    or new.session_expires_at is distinct from old.session_expires_at
    or new.session_duration_minutes is distinct from old.session_duration_minutes
    or new.created_at is distinct from old.created_at
    or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
  then
    raise exception 'only grant revocation is permitted' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists access_grants_owner_update_guard on public.access_grants;
create trigger access_grants_owner_update_guard
  before update on public.access_grants
  for each row execute function public.guard_access_grant_owner_update();

revoke all on function public.guard_access_grant_owner_update() from public, anon, authenticated;

-- Keep the RPC service-role-only while moving duration authority into the
-- locked grant row, so later settings changes cannot alter an issued code.
drop function public.consume_access_code(text, text, integer, text, text);

create function public.consume_access_code(
  p_slug       text,
  p_code_hash  text,
  p_ip_hash    text default null,
  p_user_agent text default null
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
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'grant_id', null,
                              'scope', null, 'session_expires_at', null);
  end if;

  select public.check_lockout('slug', p_slug) into v_locked;
  if v_locked is not null then
    perform public.record_access_event(v_owner, null, p_slug, 'locked', p_ip_hash, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'locked', 'grant_id', null,
                              'scope', null, 'session_expires_at', null);
  end if;

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
        session_expires_at = now() + make_interval(
          mins => greatest(1, least(60, v_grant.session_duration_minutes))
        )
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

revoke all on function public.consume_access_code(text, text, text, text) from public, anon, authenticated;
grant execute on function public.consume_access_code(text, text, text, text) to service_role;

-- Return the database clock with the absolute deadline so a visitor's
-- countdown does not depend on the device's wall-clock setting.
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
    'visitor_theme', p.visitor_theme,
    'visitor_layout', p.visitor_layout,
    'visitor_intro', p.visitor_intro,
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'email' and f.is_public and not f.is_sensitive
    ), '[]'::jsonb),
    'phones', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'phone' and f.is_public and not f.is_sensitive
    ), '[]'::jsonb),
    'social_links', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id and f.kind = 'social_link' and f.is_public and not f.is_sensitive
    ), '[]'::jsonb),
    'documents', case when g.include_documents then coalesce((
      select jsonb_agg(
               jsonb_build_object('id', d.id, 'name', d.name, 'mime', d.mime, 'size', d.size)
               order by d.created_at desc
             )
      from public.documents d
      where d.owner_id = p.owner_id and d.is_shared
    ), '[]'::jsonb) else '[]'::jsonb end,
    'can_view_documents', g.include_documents,
    'session_expires_at', g.session_expires_at,
    'server_now', now()
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

revoke all on function public.get_granted_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.get_granted_profile(uuid, text) to service_role;
