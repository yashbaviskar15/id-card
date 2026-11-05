# Private Identity Vault

A private identity card and document vault for a single owner. Access to the profile is by owner-issued one-time codes only.

## Quick Fix for "Invalid server environment"

If you see an error about missing environment variables (like `ACCESS_CODE_SECRET`, `IP_HASH_SECRET`, etc.), follow these steps:

1.  **Generate Secrets**: Run the following command in your terminal to generate the required secrets:
    ```bash
    node scripts/generate-secrets.mjs
    ```
2.  **Configure Vercel**: Copy the output and add those variables to your Vercel project settings under **Settings > Environment Variables**.
3.  **Redeploy**: Go to the **Deployments** tab in Vercel and trigger a redeploy of the latest version.

For more details, see [SETUP.md](./SETUP.md).

## Features

- **Single Owner**: Only one account can be the owner.
- **Private Profile**: Access to sensitive documents is protected by HMAC-SHA256 access codes.
- **AES-256-GCM Encryption**: Sensitive data like identity numbers are encrypted at rest with a rotate-able keyring.
- **Coarse IP Hashing**: Privacy-preserving audit logs that don't store raw IP addresses.
- **Self-contained**: All assets (fonts, icons) are self-hosted.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Encryption**: Node.js `crypto`

## Development

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Copy `.env.example` to `.env.local` and fill in the values.
4.  Run the dev server: `npm run dev`

## Deployment

Refer to [SETUP.md](./SETUP.md) for full deployment instructions, including Supabase schema setup and required environment variables.
