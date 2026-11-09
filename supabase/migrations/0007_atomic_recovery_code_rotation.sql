-- Atomically replace the authenticated owner's one-time recovery codes.
-- The application passes only Argon2id hashes; plaintext codes never reach SQL.
create or replace function public.replace_backup_recovery_codes(p_code_hashes text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if coalesce(array_length(p_code_hashes, 1), 0) <> 10 then
    raise exception 'invalid recovery code set' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_code_hashes) as supplied(code_hash)
    where supplied.code_hash is null
       or length(supplied.code_hash) < 20
       or length(supplied.code_hash) > 255
  ) then
    raise exception 'invalid recovery code hash' using errcode = '22023';
  end if;

  delete from public.backup_recovery_codes
  where owner_id = auth.uid();

  insert into public.backup_recovery_codes (owner_id, code_hash)
  select auth.uid(), supplied.code_hash
  from unnest(p_code_hashes) as supplied(code_hash);
end;
$$;

revoke all on function public.replace_backup_recovery_codes(text[]) from public, anon;
grant execute on function public.replace_backup_recovery_codes(text[]) to authenticated;
