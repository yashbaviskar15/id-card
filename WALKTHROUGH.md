# Walkthrough — authentication & security gaps

This file is the honest status report for the "auth-security gaps + settings gaps
+ orphan-alert wiring + missing docs" workstream. It records what was built, what
was actually run locally, what could **not** be verified in this sandbox, and
what still needs your action. Nothing below is claimed unless it was executed;
the verification plan it maps to is `PLAN.md` §18.

## What was built

### A. TOTP two-factor (Supabase Auth MFA)

* Security page (`/dashboard/security`) now hosts a real two-factor panel.
  * Set up: `supabase.auth.mfa.enroll({ factorType: 'totp' })` → QR rendered as
    SVG `<rect>` elements from the module matrix (computed server-side with
    `qrcode`; **no** `dangerouslySetInnerHTML`) plus the manual setup key.
  * Confirm: `mfa.challenge({ factorId })` then
    `mfa.verify({ factorId, challengeId, code })` with a 6-digit code
    (`totpCodeSchema`). On success `owner_settings.totp_enabled = true`.
  * Turn off: password re-auth gated (`isReauthenticated`), then
    `mfa.unenroll({ factorId })`, delete the owner's recovery codes and set
    `totp_enabled = false`.
  * Current factors are listed with status.
* Login flow: after a correct password, if the account has a verified TOTP
  factor and the session is still `aal1`, the form shows a TOTP challenge step
  (`verifyMfaLoginAction`). Error copy stays generic; failures are audited
  (`auth.mfa_verify_failed`).
* Server-side enforcement: middleware computes `needsMfa` and redirects any
  `/dashboard` request back to `/login?next=…` until the session has reached
  `aal2`, so the second factor cannot be skipped by navigating directly.

### B. Recovery codes

* `generateRecoveryCodesAction` (re-auth gated) creates **10** codes with
  `generateRecoveryCode()` (format `XXXXX-XXXXX`), deletes the owner's previous
  rows, and inserts **only argon2id hashes** (`hashPassword`) into
  `backup_recovery_codes`. Plaintext codes are shown exactly once (copy /
  download) and never logged or stored. The Security page afterwards shows the
  count of unused codes. Regeneration calls `alertRecoveryCodesRegenerated()`.

### C. Passkeys / WebAuthn

* Implemented for real against the SDK's native passkey API (available in
  `@supabase/supabase-js` 2.119.0; enabled by default — the old
  `experimental.passkey` flag is a deprecated no-op).
  * Settings page: `PasskeysPanel` lists passkeys (`auth.passkey.list()`), adds
    one (`auth.registerPasskey()`) and removes one
    (`auth.passkey.delete({ passkeyId })`).
  * Login page: "Sign in with a passkey" via `auth.signInWithPasskey()`.
* If the browser has no WebAuthn support (or is not on a secure origin) the
  panel renders an **explanatory state**, not a dead disabled button.

### D. Settings gaps

* Change email via `changeEmailAction` → `supabase.auth.updateUser({ email })`,
  validated with `emailSchema`, re-auth gated, with copy explaining that the
  change completes only after confirming from both the current and new inbox.
* "This session" card now shows real, obtainable data: signed-in email, last
  sign-in (`user.last_sign_in_at`), browser (`user-agent` header) and session
  expiry (`session.expires_at`). It honestly documents that Supabase's current
  auth API cannot list all sessions, and keeps "sign out of all other devices".
* Access defaults (privacy defaults) are editable: `default_scope`,
  `default_validity_minutes` (1–30) and `visitor_session_minutes` (1–60), saved
  through an owner-scoped upsert.
* The previously disabled "Not available" two-factor control was replaced with a
  working link to the Security page; the passkey explanation block was replaced
  with the live panel.

### E. Orphan alerts wired

* `alertSensitiveReveal({ field })` — fired from a new server action
  (`revealFieldAction`) when a masked sensitive value is revealed in the
  information manager. A server action is used so the server-only mail module is
  never imported into client code.
* `alertBackupExported()` — fired after a successful export in **both**
  `/api/backup` (zip / csv / json) and `/api/backup/encrypted`.
* `alertRecoveryCodesRegenerated()` — fired from recovery-code generation.
* All are best-effort: they never block or fail the request (the mail adapter
  swallows send errors, and callers fire them without awaiting).

### F. Docs

* `docs/key-rotation.md` — created (was referenced by `PLAN.md` §10 but missing).
  It also records a known pre-existing discrepancy: `scripts/rotate-keys.mjs`
  builds the AAD segment as `value` while the application uses `value_encrypted`,
  so rotation is blocked on that one-line fix.
* This file (`WALKTHROUGH.md`).

## Added server actions, routes and database writes

Server actions:

* `src/app/dashboard/security/mfa-actions.ts` — `startTotpEnrollmentAction`,
  `verifyTotpAction`, `disableTotpAction`, `generateRecoveryCodesAction`.
* `src/app/(auth)/actions.ts` — `verifyMfaLoginAction` (new); `signInAction`
  modified to require the second factor; shared `finalizeLogin` helper.
* `src/app/dashboard/settings/actions.ts` — `updatePrivacyDefaultsAction` (new),
  `changeEmailAction` (new); `updateSettingsAction` /
  `signOutOtherSessionsAction` unchanged.
* `src/app/dashboard/info/actions.ts` — `revealFieldAction` (new).

Route handlers (modified to emit alerts only):

* `src/app/api/backup/route.ts`, `src/app/api/backup/encrypted/route.ts`.

Database writes:

* Supabase Auth: `mfa.enroll/challenge/verify/unenroll`, `auth.updateUser`
  (`email`), `auth.signOut({ scope: 'others' })`.
* `owner_settings`: `totp_enabled`; `default_scope`,
  `default_validity_minutes`, `visitor_session_minutes` (all owner-scoped).
* `backup_recovery_codes`: delete the owner's rows, then insert 10 argon2id
  hashes (owner-scoped).
* `audit_log` via `writeAudit`: `auth.login`, `auth.mfa_verify_failed`,
  `auth.email_change_requested` (plus previously existing actions).

## Database changes needed

One migration was added: `supabase/migrations/0006_auth_security.sql`. It adds an
owner-scoped `INSERT` policy on `public.backup_recovery_codes`
(`owner_id = auth.uid()`) so the app can rotate codes through the user client
while RLS stays in force. No schema (column) change is required — `totp_enabled`
and the privacy-default columns already exist from `0001`.

`supabase/schema.sql` was regenerated from the migrations directory:

```
node scripts/build-schema.mjs
# wrote supabase/schema.sql from 6 migration(s): 0001…, 0006_auth_security.sql
```

Apply it to your project before using recovery codes:

```
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
```

**This was not run here** (no database access; the task forbids running
migrations). Until applied, generating recovery codes will fail its insert.

## What was verified locally

Run in this sandbox on the changed files:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 — no type errors |
| `npx eslint <changed files>` | exit 0 — no lint errors |
| `node scripts/build-schema.mjs` | exit 0 — `schema.sql` regenerated from 6 migrations |

`next build` was intentionally **not** run, and migrations were **not** applied,
per the task instructions.

## What could NOT be verified here (honest limits)

These require resources the sandbox does not have. They are the parts to check
first, matching `PLAN.md` §18 (18.2 auth, 18.5 alerts/backup, 18.7 build):

* **Live Supabase.** No Supabase project/keys are configured, so the MFA
  enrollment/challenge/verify round-trip, the `aal2` login step, recovery-code
  insert (needs migration 0006) and email change were not exercised end to end.
  §18.2 is therefore **not verified**.
* **TOTP login step.** The gate is implemented and typechecked, and middleware
  enforces `aal2`, but no real authenticator code was submitted. Verify by
  enabling 2FA, signing out, and confirming the code prompt appears and `/dashboard`
  is unreachable at `aal1`.
* **Passkeys.** `registerPasskey` / `signInWithPasskey` need a real browser on a
  secure origin and Supabase WebAuthn endpoints. Only the capability-detection
  fallback path is deterministic here. §18.6 is **not verified**.
* **Email delivery / alerts.** No `RESEND_API_KEY` / `ALERT_*` env vars, so
  alerts fall back to the server log. Real delivery is unverified (§18.5).
* **Docker / deployed HTTPS-HSTS.** Not available; deployed-only behaviour is
  unverified (see `PLAN.md` §18 "Honest limits").

## What needs your action

1. Apply migration `0006_auth_security.sql` (or the regenerated `schema.sql`) to
   your Supabase project.
2. Confirm **TOTP (MFA)** is enabled for the project and passkeys/WebAuthn are
   allowed.
3. Configure the email provider (`RESEND_API_KEY`, `ALERT_FROM_EMAIL`,
   `ALERT_TO_EMAIL`) if you want real alert delivery.
4. Decide on the `scripts/rotate-keys.mjs` AAD fix recorded in
   `docs/key-rotation.md` before relying on key rotation.
5. Run the §18.2 / §18.6 checks against a real Supabase test project.
