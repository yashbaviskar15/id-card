# Private Digital Identity Card and Document Vault

## Step 0: implementation plan

This plan is for a single-owner Next.js App Router application backed by Supabase Auth, Postgres, and private Storage. The owner is the only person who can sign in or issue visitor access. Visitors never query Supabase directly.

## Non-negotiable invariants

- The QR payload is exactly `${NEXT_PUBLIC_SITE_URL}/p/<slug>`.
- `NEXT_PUBLIC_SITE_URL` is required at build time and must be the configured production origin.
- `slug` is generated once with cryptographic randomness at first profile creation, is at least 12 characters, is not derived from identity fields, and is excluded from all profile update payloads.
- A database trigger rejects any later slug change. Profile updates use an explicit column list and never replace the row.
- QR output is generated on demand. No QR image is stored.
- The pre-unlock response contains only the lock screen; it contains no profile data, including identity, photo, or metadata.
- Visitor profile reads happen server-side only after an atomically consumed grant and a validated signed visitor session.
- Visitor-visible profile fields are allowlisted by scope and privacy flags. Sensitive records, private notes, account records, documents, and sensitive identification values are never in the visitor response.
- Service-role credentials exist only in server runtime code and server environment variables.
- The owner kill switch disables the public profile without changing the QR payload.
- Access grants are one-use, hashed at rest, time-limited, revocable, and independent of the QR.

## Data model

All tables have RLS enabled. Owner-owned tables use `owner_id uuid not null references auth.users(id)`. Visitor access is mediated by server code and service-role queries; no visitor role receives direct table access.

### `profiles`

- `owner_id` primary key and foreign key to `auth.users`
- `slug` unique, non-null, immutable after insert
- `full_name`, `dob`, `address`, `photo_path`
- `show_dob`, `show_address`, `show_photo`
- `is_active`
- created and updated timestamps

A trigger rejects updates where `OLD.slug <> NEW.slug`. The application uses explicit update columns that exclude `slug`.

### `fields`

- owner, kind (`email`, `phone`, or other approved personal field), label, value
- `is_public`, `sort`
- Sensitive kinds are excluded from visitor projections regardless of accidental flags.

### `categories`

- owner, name, created timestamp
- A first-login transaction seeds the requested default categories once; custom categories are unlimited.

### `documents`

- owner, category, name, private `storage_path`, validated MIME, extension, size
- timestamps and soft-delete/revocation metadata as needed
- Storage paths use `<owner_id>/<uuid>-<safe-name>`.

### `share_links`

- owner, document, token HMAC/hash, optional password hash
- expiry, optional maximum downloads, download count, revoked timestamp
- no raw token or password is stored

### `access_grants`

- owner, slug, code HMAC, scope (`contact` or `full`)
- created, expires, consumed, session expiry, and revoked timestamps
- unique active-code constraint/strategy
- status is derived as active, used, expired, or revoked

The raw eight-digit code is returned once at creation and is never persisted.

### `access_log`

- owner, grant, slug, outcome, coarse IP representation/hash, user agent, timestamp
- never stores submitted codes or sensitive field values

### `audit_log`

- owner, actor type, action, target type/id, safe metadata, timestamp
- append-only policy; reveal, export, sharing, access issuance, revocation, and authentication events are audited

### Visitor session

Use a signed, encrypted or integrity-protected, `httpOnly`, `Secure`, `SameSite=Lax` cookie containing only the grant/session identifier and slug binding. Every gated request validates grant existence, usage/revocation state, expiry, owner kill switch, and slug before fetching an allowlisted server-side projection. Default session lifetime is 15 minutes and is not extended by visitor activity.

## Route map

### Public visitor routes

- `GET /p/[slug]`: no-store lock screen only; no profile lookup before unlock.
- `POST /p/[slug]/unlock`: validate input, rate-limit, atomically consume a matching grant, create the bound visitor cookie, and redirect to the gated view. Wrong, expired, used, revoked, and invalid inputs share identical public error text.
- `GET /p/[slug]/profile`: server-side session validation, then scope-filtered profile projection.
- `GET /p/[slug]/vcard`: same session check; returns a vCard 3.0 only after authorization.
- `GET /p/[slug]/qr.png`, `/qr.svg`, and `/qr-print.png`: deterministic QR rendering from the configured URL, with no stored image.

All `/p/*` and vCard responses use `Cache-Control: no-store`, noindex, and the security header baseline.

### Owner routes

- `/login`: owner email OTP entry.
- `/auth/callback`: server callback and session establishment.
- `/dashboard`: authenticated shell and summary.
- `/dashboard/card`: editable card preview, print/PDF/PNG exports, front/back views.
- `/dashboard/access`: issue, view, revoke grants and sessions; inspect access outcomes.
- `/dashboard/vault`: browse, search, upload, preview, rename, move, delete, usage.
- `/dashboard/shares`: create, inspect, revoke, and download document share links.
- `/dashboard/information`: manage personal fields, privacy switches, contacts, dates, notes, and account records.
- `/dashboard/settings`: owner security, session management, kill switch, export/restore.

### Server endpoints/actions

Use typed server actions or route handlers with Zod validation for owner mutations. Sensitive actions require a recent re-authentication or supported passkey/TOTP step. The service role is imported only by server modules that perform the post-session visitor projection or privileged transactional operations.

## RLS policy table

| Resource | Anonymous | Authenticated owner | Other authenticated user | Visitor session |
| --- | --- | --- | --- | --- |
| `profiles` | deny | select/update own row; insert only own initial row | deny | deny direct access |
| `fields` | deny | full CRUD own rows | deny | deny direct access |
| `categories` | deny | full CRUD own rows | deny | deny direct access |
| `documents` | deny | full CRUD own rows | deny | deny direct access |
| `share_links` | deny | full CRUD own links | deny | deny direct access |
| `access_grants` | deny | create/select/revoke own grants | deny | deny direct access |
| `access_log` | deny | select own logs; server append only | deny | deny direct access |
| `audit_log` | deny | select own logs; append-only server path | deny | deny direct access |
| Storage bucket | deny | own prefix only through signed server operations | deny | signed link only when explicitly authorized |
| Public profile functions | deny | no client dependency | deny | no direct invocation |

The legacy `public_profile()` function is removed or made inaccessible to both anonymous and authenticated database roles. Any remaining server function is narrowly scoped and not exposed to visitor clients.

## Security and threat model

| Threat | Control | Verification |
| --- | --- | --- |
| Shoulder-surfing of the one-time code | Short validity, one use, explicit revoke, no code persistence, owner-controlled display | Confirm code is consumed once and revoke ends access |
| Brute-force guessing | Per-IP/per-slug five-failure limit in ten minutes; global ten-failure slug lockout for fifteen minutes; invalidate outstanding grants; alert owner | Integration test wrong attempts, lockout, invalidation, and alert path |
| Code sharing | Scope-limited grant, one atomic consume, short expiry, session bound to grant and slug, owner revocation | Two clients cannot reuse one code; revocation immediately blocks session |
| Replay | Atomic database consume with row lock/conditional update, used timestamp, signed session checks on every request | Concurrent consume test allows exactly one success |
| Profile leakage before unlock | Lock-screen-only render, no profile query, no public DB access, no caching | `curl` HTML/API inspection for identifying fields and route tests |
| Scope escalation | Server-side allowlisted projection, contact/full scope checks, privacy flags | Contact-only response excludes photo, DOB, and address |
| Sensitive data leakage | Sensitive kinds excluded from projections; private tables/storage never visitor-readable | Assert no Aadhaar/PAN, notes, account, document, or financial data in responses/logs |
| QR mutation | Immutable random slug, trigger, explicit updates, deterministic rendering | Byte-for-byte QR comparison after all listed mutations |
| Storage exposure | Private bucket, safe paths, signed URLs <= 60 seconds, hashed share tokens | Storage policy and expiry tests |
| Session theft/extension | Signed secure cookie, no-store, server validation, fixed expiry, revocation checks | Expiry and revoke tests; inspect cookie flags |
| Owner account compromise | Restricted email OTP, TOTP, optional passkey, recent re-auth for sensitive actions, sign-out all devices | Authentication and re-authentication browser tests |
| CSRF and malformed input | Same-site cookies, server actions/route checks, Zod validation, security headers/CSP | Negative request tests and header checks |

## Workstream split after approval

Each workstream owns separate files and exposes a small contract to the others.

- **A. Database and security:** migrations/schema, RLS, storage policies, immutable-slug trigger, grants/logs/audit tables, atomic consume function, lockout transaction, database tests.
- **B. Auth:** owner-only email OTP, TOTP, optional WebAuthn/passkey, session age/re-authentication, sign-out-all-devices, server auth helpers.
- **C. Card and QR:** ID-1 card views, data binding, deterministic QR renderer, PNG/SVG/PDF/bleed exports, print styles.
- **D. Access gate:** lock screen, verification action, hashing/rate limiting/lockout, visitor cookie, gated projection, vCard, owner access page.
- **E. Vault:** private upload and validation, categories, previews, signed downloads, storage usage, document share links and password/expiry/download limits.
- **F. Information manager:** personal fields, contacts, addresses, dates, family/emergency contacts, notes, account records, independent privacy controls and masking/reveal audit.
- **G. Dashboard and QA:** layout/navigation, global search, backup/restore UX, accessibility, browser flows, performance, headers, end-to-end coverage, final repository scans.

## Task list

### Foundation

- [ ] Create Next.js App Router TypeScript project with Tailwind and the chosen component primitives.
- [ ] Add strict environment validation; fail build when `NEXT_PUBLIC_SITE_URL` or required server secrets are missing.
- [ ] Add `.env.example`, `SETUP.md`, security headers/CSP, noindex defaults for private routes, and no-store handling for visitor routes.
- [ ] Configure Supabase clients so the service role cannot be imported by client modules.

### Database and access control

- [ ] Implement schema, indexes, constraints, seed-category transaction, RLS, private Storage policies, and append-only audit rules.
- [ ] Implement random slug creation, immutable-slug trigger, and explicit profile update procedure.
- [ ] Implement HMAC-SHA256 code hashing, timing-safe comparison, atomic consume, status derivation, revocation, and lockout.
- [ ] Implement access/audit logging with coarse IP and sanitized user-agent data.
- [ ] Add two-user RLS tests plus anonymous function/table denial tests.

### Authentication

- [ ] Restrict sign-in to the owner email and disable public sign-up.
- [ ] Add email OTP, TOTP, optional passkey fallback, session timeout, recent re-authentication, and sign-out-all-devices.

### Visitor experience

- [ ] Build lock screen with zero profile data in server output.
- [ ] Build code issuance with scope, validity 1-30 minutes, countdown, copy, and revoke.
- [ ] Build unlock, fixed visitor session, expiry/revocation handling, allowlisted profile projections, tap actions, and vCard.
- [ ] Add QR generation/downloads and permanence tests.

### Card, vault, and information manager

- [ ] Build editable front/back ID-1 card and export paths, including 300 DPI and bleed variants.
- [ ] Build vault upload validation, category management, previews, search, rename/move/delete, signed downloads, and usage.
- [ ] Build share links with hashed tokens, optional password, expiry, download limits, revoke, rate limiting, and audit.
- [ ] Build information sections with independent privacy toggles, masking, reveal re-authentication, and audit events.

### Dashboard and verification

- [ ] Build responsive dashboard shell and all async loading/error/empty states.
- [ ] Build JSON/CSV and ZIP backup plus documented restore path.
- [ ] Run typecheck, lint, build, database tests, unit/integration tests, and browser tests with screenshots.
- [ ] Run the repo-wide forbidden-term scan and inspect every result before declaring completion.
- [ ] Create a walkthrough artifact recording verified behavior, failures, residual risks, and required owner actions.

## Verification gates

No implementation phase is complete until its focused tests pass. Final verification must cover:

- Two-user and anonymous RLS isolation.
- Correct, reused, expired, revoked, and wrong codes with identical public errors.
- Rate limits, global lockout, outstanding-grant invalidation, and alert behavior.
- Session expiry and immediate revocation.
- Contact-only and full-scope field filtering.
- No sensitive records in visitor HTML, API responses, vCards, logs, or storage URLs.
- Stable QR bytes after profile, field, document, grant, and authentication mutations.
- Lock-screen performance and security headers.
- Browser screenshots for OTP login, access issuance, mobile unlock, upload, rename, download, and password-protected sharing.
- Typecheck, lint, production build, end-to-end tests, and whole-repository forbidden-term scan.

## Assumptions and questions before implementation

Assumptions:

- The owner will provide the final production origin for `NEXT_PUBLIC_SITE_URL` before deployment, but no credential or secret is needed for planning.
- Supabase Auth is the source of truth for the one owner account; no second owner or public registration is required.
- The default visitor session is 15 minutes and the default grant validity is 5 minutes, with the specified owner controls.
- Email alert delivery will use a server-side provider selected during setup; its credentials will be supplied through environment variables.
- The initial implementation can make passkey support optional where browser/device support is unavailable, while keeping TOTP as the fallback.

Blocking questions:

1. What final production origin should be assigned to `NEXT_PUBLIC_SITE_URL` before deployment?
2. Which owner email address should be allowlisted in Supabase Auth?
3. Which server-side email provider should receive lockout alerts?

Approval needed: confirm this plan and answer the three questions, or provide corrections. No application code should be written until approval.
