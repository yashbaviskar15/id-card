-- ----------------------------------------------------------------------------
-- 0006 — Authentication & security.
--
-- Two-factor recovery codes live in `backup_recovery_codes` (created in 0001).
-- That migration gave the owner SELECT (metadata only) and DELETE policies and
-- stated that writes are service-role only. Rotating the codes needs a
-- server-side write that is still bound to the owner, so this migration adds the
-- matching owner-scoped INSERT policy. RLS stays in force: a row can only be
-- inserted (or deleted) for the authenticated owner.
--
-- Codes are never stored in the clear: the application writes argon2id hashes.
-- No other schema change is required — `owner_settings.totp_enabled` and the
-- privacy-default columns already exist from 0001.
-- ----------------------------------------------------------------------------

drop policy if exists backup_recovery_codes_insert_own on public.backup_recovery_codes;
create policy backup_recovery_codes_insert_own on public.backup_recovery_codes
  for insert to authenticated with check (owner_id = auth.uid());
