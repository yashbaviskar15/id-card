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
