-- ----------------------------------------------------------------------------
-- 0005 — Share links.
--
-- A share link hands out one vault document without an access code: the token
-- travels in the URL, only its hash is stored, and it can expire, be revoked or
-- be capped by a download count. `share_links` itself has been present since
-- 0001; this migration adds the single privileged function that consumes a
-- download atomically (row lock + count increment) so two concurrent requests
-- can never overshoot max_downloads.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- consume_share_download — the single atomic path that turns a token hash into
--   one streamable object. Under a row lock it rejects a missing, revoked,
--   expired or exhausted link (returning null), then increments the counter,
--   stamps last_accessed_at and returns the storage target.
-- ----------------------------------------------------------------------------

create or replace function public.consume_share_download(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_links%rowtype;
  v_doc  public.documents%rowtype;
begin
  select * into v_link
  from public.share_links
  where token_hash = p_token_hash
  for update;

  if not found then
    return null;
  end if;

  if v_link.revoked_at is not null then
    return null;
  end if;

  if v_link.expires_at <= now() then
    return null;
  end if;

  if v_link.max_downloads is not null and v_link.download_count >= v_link.max_downloads then
    return null;
  end if;

  update public.share_links
    set download_count = download_count + 1,
        last_accessed_at = now()
    where id = v_link.id
    returning * into v_link;

  select * into v_doc
  from public.documents
  where id = v_link.document_id and owner_id = v_link.owner_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'share_id', v_link.id,
    'owner_id', v_link.owner_id,
    'storage_path', v_doc.storage_path,
    'name', v_doc.name,
    'mime', v_doc.mime
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges: definer functions stay service-role only.
-- ----------------------------------------------------------------------------

revoke all on function public.consume_share_download(text) from public, anon, authenticated;
grant execute on function public.consume_share_download(text) to service_role;
