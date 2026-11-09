# Key rotation

This document describes how to rotate the AES-256-GCM key that protects
sensitive field values (`fields.value_encrypted`) without downtime and without
changing any permanent identifier. It is referenced from `PLAN.md` §10.

## What is encrypted, and how

Only rows with `is_sensitive = true` have their real value stored encrypted.
The plaintext column `fields.value` keeps a masked display form; the ciphertext
lives in `fields.value_encrypted` in this envelope format:

```
v1.<keyId>.<nonce base64url>.<ciphertext base64url>.<auth tag base64url>
```

* Algorithm: AES-256-GCM, 32-byte key, fresh 12-byte random nonce per record.
* Additional authenticated data (AAD) binds the ciphertext to its exact
  location: `fieldAad(ownerId, entityId, column)` → `ownerId:entityId:column`.
  For sensitive fields the column is `value_encrypted`
  (`src/lib/crypto/fields.ts`), so the AAD is
  `"<owner_id>:<field_id>:value_encrypted"`. A ciphertext moved to another row
  or column fails to decrypt.

The keyring and the active key are server-only environment variables
(`src/lib/env.server.ts`, never bundled for the browser):

| Variable | Meaning |
|---|---|
| `FIELD_ENCRYPTION_KEYS` | JSON object `{ "<keyId>": "<base64 32 bytes>" }` — every key still needed to read old rows |
| `FIELD_ENCRYPTION_ACTIVE_KEY` | The `keyId` used for **new** writes; must exist in `FIELD_ENCRYPTION_KEYS` |

Generate keys with `node scripts/generate-secrets.mjs` (or any 32-byte CSPRNG
value encoded as base64).

## Rotation procedure

Rotation is **idempotent and resumable**: running it twice is safe, and it can
be interrupted and re-run. It never touches `profiles.slug`, so the QR payload
is unaffected (`PLAN.md` invariant §8.7).

1. **Add the new key alongside the old one.** In `FIELD_ENCRYPTION_KEYS`, add a
   new entry, e.g. `"2026-11": "<base64 32 bytes>"`. Keep the old key(s) —
   existing rows still reference them by `keyId`.

2. **Switch the active key.** Set `FIELD_ENCRYPTION_ACTIVE_KEY=2026-11`.
   New values are now written under the new key. Do not remove old keys yet.

3. **Preview the re-encryption.**

   ```
   npm run keys:rotate -- --dry-run
   ```

   Prints each row that would be migrated (`<oldKeyId> -> <newKeyId>`) plus a
   summary count. No writes happen.

4. **Re-encrypt.**

   ```
   npm run keys:rotate
   ```

   Reads every non-null `value_encrypted`, decrypts with the key named in the
   envelope, re-encrypts with the active key, and updates the row.
   Already-current rows are skipped.

5. **Verify.** Re-run the dry run — it should report `rotated 0`. Spot-check
   that a sensitive field still reveals correctly in the dashboard.

6. **Remove the old key** from `FIELD_ENCRYPTION_KEYS` only once the dry run
   reports `rotated 0` (i.e. no row still references it). Removing a key that is
   still in use will make those rows permanently unreadable.

## Requirements

The script (`scripts/rotate-keys.mjs`) reads its own environment from
`.env.local` / `.env` and needs:

* `SUPABASE_DB_URL` — direct Postgres connection string.
* `FIELD_ENCRYPTION_KEYS` and `FIELD_ENCRYPTION_ACTIVE_KEY` (as above).

## Known discrepancy (follow-up)

The rotation script currently builds the AAD as `"<owner_id>:<id>:value"`
(`${row.owner_id}:${row.id}:value`). The application encrypts sensitive fields
with the column segment `value_encrypted`
(`fieldAad(owner.id, current.id, 'value_encrypted')`). Because the AAD strings
differ, the script's `decrypt` step will fail the GCM tag check on rows written
by the application, so rotation cannot complete until the script's AAD segment
is changed from `value` to `value_encrypted`.

This is a pre-existing mismatch in `scripts/rotate-keys.mjs` and is called out
here rather than left silent. Treat a successful rotation as blocked on that
one-line fix; the rest of the procedure above is unaffected.
