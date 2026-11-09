# Setup Guide

This guide explains how to fix the "Invalid server environment" errors and complete your deployment.

## 1. Generate Required Secrets

The application requires several cryptographic secrets to handle encryption, hashing, and session signing. You can generate these by running the provided script in your terminal:

```bash
node scripts/generate-secrets.mjs
```

This will output a set of environment variables. **Copy them.**

## 2. Add Environment Variables to Vercel

1.  Go to your **Vercel Dashboard**.
2.  Select your `id-card` project.
3.  Go to **Settings > Environment Variables**.
4.  Add the following variables (paste the values you generated in Step 1):

| Variable | Requirement | Purpose |
| :--- | :--- | :--- |
| `ACCESS_CODE_SECRET` | 32+ chars | Hashes 8-digit access codes |
| `SESSION_COOKIE_SECRET` | 32+ chars | Signs session cookies |
| `IP_HASH_SECRET` | 32+ chars | Salts IP address hashes |
| `FIELD_ENCRYPTION_KEYS` | JSON object | AES-256-GCM keyring |
| `FIELD_ENCRYPTION_ACTIVE_KEY` | String (e.g., `k1`) | Currently active key ID |

### Important Variables Already Set (Verify These)

Ensure these are also correctly set in your Vercel project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (Must be `https://ecard-personal.aravanta.tech`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (Postgres connection string)
- `OWNER_EMAIL` (The email address you will use to sign in)

### Configure password-reset email links

In the Supabase project referenced by `NEXT_PUBLIC_SUPABASE_URL`, open
**Authentication > URL Configuration** and set:

- **Site URL:** `https://ecard-personal.aravanta.tech`
- **Redirect URL allowlist:** `https://ecard-personal.aravanta.tech/auth/callback**`

The production redirect must be allowlisted. If Supabase rejects the requested callback,
it falls back to its Site URL; a Site URL of `http://localhost:3000` sends reset links to
the developer's machine instead of the live app.
Do not set the production Site URL to localhost.

In **Authentication > Email Templates > Reset Password**, keep the link as
`{{ .ConfirmationURL }}` so Supabase verifies the one-time token and returns to the allowed
callback. Set the email OTP/link expiry to **1800 seconds** to match the app's 30-minute
message. Links are single-use; clicking an older email after requesting a newer one can also
invalidate the earlier token.

### Verify social previews

After deploying to the HTTPS production domain, test a public URL such as the home page or
a deliberately invalid `/s/...` link. Do not test a private document-view URL.

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/): enter the URL,
  select **Debug**, then **Scrape Again**.
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/): inspect the URL and
  confirm the title, description, and image.
- [opengraph.xyz](https://www.opengraph.xyz/): preview the initial server-rendered metadata.
- WhatsApp: send the HTTPS URL to a chat you can check, then confirm the generated preview
  uses the public `Private Identity` image and generic description.

The public-route Playwright test checks the initial HTML (without executing page JavaScript),
absolute HTTPS metadata URLs, HTTP 200 responses for referenced public assets, and the
1200x630 JPEG size limit. The production preview image is
`https://ecard-personal.aravanta.tech/og/private-identity.jpg`.

Protected profile and file-share routes intentionally use generic preview text and imagery:
social crawlers cannot complete the owner's access-code/password flow, and private names,
emails, and file names must not be exposed in crawler-readable HTML.

Preview services cache results. Use **Scrape Again** in Facebook and re-inspect with LinkedIn
after a change. WhatsApp has no public cache-purge tool; if an image changes, publish it at a
new versioned filename and update the metadata image URL. A new unique share URL may also be
needed while an old preview expires.

## 3. Apply Database Migrations

The deployed Supabase project must have **all migrations `0001` through `0008`**. In
particular, access-code document permissions require `0002`, share-link downloads require
`0005` and safe storage-path validation requires `0008`, recovery-code writes require `0006`,
and atomic recovery-code rotation requires `0007`. From a trusted machine with the Supabase CLI installed, link the exact project used
by `NEXT_PUBLIC_SUPABASE_URL`, then review and apply pending migrations:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase migration list --linked
npx supabase db push --linked --yes
```

If a previous push stopped at `0004_visitor_presentation.sql` with
`column "visitor_theme" already exists`, update to the latest repository version and rerun
`npx supabase db push --linked --yes`. Migration `0004` is safe to retry and preserves existing
presentation values that are valid. Do not reset the project or mark the failed migration as
applied; later security/share migrations still need to run.

The project ref is available in Supabase **Project Settings > General**. Review and back up
production data before applying migrations. Do not commit database credentials or expose them
through client-visible variables; keep the connection string only in server-side
`SUPABASE_DB_URL`.
If a database URL has been pasted into a chat or committed, rotate its database password
before using it again. URL-reserved characters in a new password must be percent-encoded
(for example, `#` as `%23`).

## 4. Verify Passkey Configuration

In the Supabase Dashboard, open the project used by `NEXT_PUBLIC_SUPABASE_URL`, then go to
**Authentication > Configuration > Passkeys** (on some dashboard versions this appears as
**Authentication > Passkeys**). Enable passkey authentication and set:

| Setting | Value |
| :--- | :--- |
| Relying Party Display Name | `Private Identity Card` |
| Relying Party ID | `ecard-personal.aravanta.tech` |
| Relying Party Origins | `https://ecard-personal.aravanta.tech` |

The ID is the bare hostname: do not include `https://`, a port, or a path. Origins must be
the exact HTTPS origin used in the browser. Save the settings, redeploy the app, then sign in
with a supported browser and add a passkey under **Dashboard > Settings > Passkeys**. A
`404`/`501` response or an unavailable endpoint means passkeys are not enabled/supported for
that Supabase Auth project; changing application code or redeploying alone cannot enable the
Auth feature. See the [official Supabase passkeys guide](https://supabase.com/docs/guides/auth/passkeys).

## 5. Review Session Expiry

In the Supabase Dashboard, open **Authentication > Sessions** and review the inactivity
timeout and maximum session lifetime. If the owner should remain signed in during regular
use, do not set an unusually short inactivity timeout. The app refreshes Supabase auth tokens
on requests; the middleware also forwards refreshed cookies to the current request and to
redirect responses. A browser tab that has been idle past the project's configured limit will
still need the owner to sign in again.

## 6. Understand Offline Mode

Open the app once while online so the service worker can install and cache its static shell.
Private dashboard pages, visitor sessions, files, access codes, share links, sign-in and security
actions are intentionally not cached: their authorization, expiry and revocation must be checked
against the server. When offline, navigation to server-backed pages and downloads is stopped
with a clear message instead of showing a failed request.

Card and information edits can be queued locally and sync after reconnecting. These queued values
are sensitive browser data, so use this feature only on a trusted personal device and sync before
signing out. A first visit while offline cannot install the PWA, and the app cannot safely
complete server-backed actions without connectivity.

## 7. Redeploy

After adding the environment variables, you need to redeploy your project for the changes to take effect:

1.  Go to the **Deployments** tab in Vercel.
2.  Click the three dots `...` next to the latest deployment.
3.  Select **Redeploy**.

Once the deployment is complete, the "Something went wrong" error should be resolved.
