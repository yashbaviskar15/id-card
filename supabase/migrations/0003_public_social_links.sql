-- Public social links are opt-in and never include sensitive fields.

alter table public.fields
  drop constraint if exists fields_kind_check;

alter table public.fields
  add constraint fields_kind_check check (kind in (
    'email', 'phone', 'social_link', 'address', 'family_contact',
    'emergency_contact', 'important_date', 'note', 'account_record', 'custom'
  ));

-- Clear any legacy invalid public flags before enforcing the stronger rule.
update public.fields
set is_public = false
where is_sensitive and is_public;

alter table public.fields
  drop constraint if exists fields_public_kind_only;

alter table public.fields
  add constraint fields_public_kind_only check (
    not is_public or (kind in ('email', 'phone', 'social_link') and not is_sensitive)
  );

comment on constraint fields_public_kind_only on public.fields is
  'Only non-sensitive email, phone, and social-link fields may be exposed to visitors.';

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
    'dob',        case when g.scope = 'full' and p.show_dob then p.dob else null end,
    'address',    case when g.scope = 'full' and p.show_address then p.address else null end,
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id
        and f.kind = 'email'
        and f.is_public
        and not f.is_sensitive
    ), '[]'::jsonb),
    'phones', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id
        and f.kind = 'phone'
        and f.is_public
        and not f.is_sensitive
    ), '[]'::jsonb),
    'social_links', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort, f.created_at)
      from public.fields f
      where f.owner_id = p.owner_id
        and f.kind = 'social_link'
        and f.is_public
        and not f.is_sensitive
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

revoke all on function public.get_granted_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.get_granted_profile(uuid, text) to service_role;
