-- Keep each share link attached to a document owned by the same account.
delete from public.share_links as link
where not exists (
  select 1
  from public.documents as document
  where document.id = link.document_id
    and document.owner_id = link.owner_id
);

alter table public.documents
  add constraint documents_id_owner_unique unique (id, owner_id);

alter table public.share_links
  add constraint share_links_document_owner_fkey
  foreign key (document_id, owner_id)
  references public.documents (id, owner_id)
  on delete cascade;

-- Check the resolved storage path before incrementing the download counter.
-- This prevents a concurrent restore from consuming quota for a stale object.
create or replace function public.consume_share_download(
  p_token_hash text,
  p_expected_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_links%rowtype;
  v_doc public.documents%rowtype;
begin
  select * into v_link
  from public.share_links
  where token_hash = p_token_hash
  for update;

  if not found
     or v_link.revoked_at is not null
     or v_link.expires_at <= now()
     or (v_link.max_downloads is not null and v_link.download_count >= v_link.max_downloads) then
    return null;
  end if;

  select * into v_doc
  from public.documents
  where id = v_link.document_id
    and owner_id = v_link.owner_id
    and storage_path = p_expected_storage_path
  for update;

  if not found then
    return null;
  end if;

  update public.share_links
  set download_count = download_count + 1,
      last_accessed_at = now()
  where id = v_link.id
  returning * into v_link;

  return jsonb_build_object(
    'share_id', v_link.id,
    'owner_id', v_link.owner_id,
    'storage_path', v_doc.storage_path,
    'name', v_doc.name,
    'mime', v_doc.mime
  );
end;
$$;

revoke all on function public.consume_share_download(text, text) from public, anon, authenticated;
grant execute on function public.consume_share_download(text, text) to service_role;
