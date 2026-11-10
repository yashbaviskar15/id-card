-- Send private, metadata-only invalidations for owner-visible data changes.
-- Row contents never enter Realtime, so hashes and private fields are not exposed.

-- Add an opaque content revision to permitted document metadata. A visitor
-- preview can then reload an already-open file when the owner replaces it.
alter function public.get_granted_profile(uuid, text)
  rename to get_granted_profile_without_document_revision;

create function public.get_granted_profile(
  p_grant_id uuid,
  p_slug text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with projection as (
    select public.get_granted_profile_without_document_revision(p_grant_id, p_slug) as value
  )
  select projection.value || jsonb_build_object(
    'documents',
    case when coalesce((projection.value->>'can_view_documents')::boolean, false) then coalesce((
      select jsonb_agg(
        shared.value || jsonb_build_object('updated_at', document.updated_at)
        order by document.created_at desc
      )
      from jsonb_array_elements(coalesce(projection.value->'documents', '[]'::jsonb)) as shared(value)
      join public.documents as document
        on document.id = (shared.value->>'id')::uuid
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from projection
  where projection.value is not null;
$$;

revoke all on function public.get_granted_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.get_granted_profile(uuid, text) to service_role;

create or replace function public.broadcast_owner_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_owner text;
  new_owner text;
  payload jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_owner := to_jsonb(old)->>'owner_id';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_owner := to_jsonb(new)->>'owner_id';
  end if;

  payload := jsonb_build_object(
    'table', tg_table_name,
    'operation', tg_op
  );

  if old_owner is not null then
    perform realtime.send(
      payload,
      'owner.invalidate',
      'owner:' || old_owner,
      true
    );
  end if;

  if new_owner is not null and new_owner is distinct from old_owner then
    perform realtime.send(
      payload,
      'owner.invalidate',
      'owner:' || new_owner,
      true
    );
  end if;

  return null;
end;
$$;

revoke all on function public.broadcast_owner_invalidation() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'fields',
    'categories',
    'documents',
    'share_links',
    'access_grants',
    'access_log',
    'owner_settings',
    'backup_recovery_codes'
  ]
  loop
    execute format(
      'drop trigger if exists owner_realtime_invalidation on public.%I',
      table_name
    );
    execute format(
      'create trigger owner_realtime_invalidation ' ||
      'after insert or update or delete on public.%I ' ||
      'for each row execute function public.broadcast_owner_invalidation()',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists owner_realtime_invalidation_receive on realtime.messages;
create policy owner_realtime_invalidation_receive
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = 'owner:' || (select auth.uid())::text
);
