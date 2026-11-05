# Setup

## Required values

Copy `.env.example` to `.env.local` and fill every value. Do not commit `.env.local`.

- `NEXT_PUBLIC_SITE_URL`: the final HTTPS origin, without a trailing slash. The build fails if this is missing. Once deployed, do not change it unless the QR is intentionally retired.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: values from the Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only. Never prefix it with `NEXT_PUBLIC_` and never expose it to browser code.
- `ACCESS_CODE_HMAC_SECRET`: a long random secret used to hash access codes and sign visitor sessions.
- `OWNER_EMAIL`: the single allowed sign-in address.
- `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO`, and `EMAIL_PROVIDER_API_KEY`: supplied by the selected server-side mail provider for lockout alerts.

## Supabase

1. Create a Supabase project and enable Auth email OTP.
2. Disable public sign-up and allow only the owner email.
3. Apply `supabase/schema.sql` in the SQL editor or through the migration workflow.
4. Confirm the `private-documents` bucket is private and review the owner-prefix storage policies.
5. Configure TOTP as the required second factor. Passkeys can be enabled for supported devices after the base flow is working.
6. Create the owner account and complete the first-login category seed transaction.

## Local checks

```bash
npm install
NEXT_PUBLIC_SITE_URL=https://identity.example npm run typecheck
NEXT_PUBLIC_SITE_URL=https://identity.example npm test
NEXT_PUBLIC_SITE_URL=https://identity.example npm run build
```

Use the real production origin for deployment. A preview origin must never be used for QR generation.

## Deployment

Set all values in the Vercel project environment settings for Production, Preview, and Development as appropriate. Set `NEXT_PUBLIC_SITE_URL` to the permanent production origin in the production environment. Deploy only after the database migration and owner authentication checks pass.

## Operational checks

- Keep the dashboard behind owner authentication and recent re-authentication for exports, sharing, reveals, and access issuance.
- Use the owner dashboard's sign-out-all-devices control after a suspected session compromise.
- Keep the visitor route and vCard route uncached.
- Treat the QR SVG as a permanence fixture: record it before profile edits and compare it byte-for-byte after every information, document, grant, and authentication mutation.