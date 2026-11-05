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

## 3. Redeploy

After adding the environment variables, you need to redeploy your project for the changes to take effect:

1.  Go to the **Deployments** tab in Vercel.
2.  Click the three dots `...` next to the latest deployment.
3.  Select **Redeploy**.

Once the deployment is complete, the "Something went wrong" error should be resolved.
