# Implementation Plan — Private Digital Identity Card + Document Vault

Single owner: **Yash Naresh Baviskar**
Status: **awaiting approval — no application code has been written yet**
Artifacts: `PLAN.md` (this file), `TASKS.md` (task list)

---

## 0. How to approve

Reply "approve" (optionally + answers to the 2 blocking questions in §19). Nothing under Phase 1+ starts before that.
Two decisions genuinely block verification, not writing: they are asked in §19.

---

## 1. Assumptions

Stated explicitly because the brief left them open. Each is cheap to change.

| # | Assumption |
|---|---|
| A1 | Fresh app scaffolded in the empty `/workspace` (npm, Node 24, lockfile committed, exact versions pinned). |
| A2 | Next.js 15 App Router + React 19 + TypeScript `strict`, Tailwind v4, shadcn/ui, `@supabase/ssr`. |
| A3 | Transactional email (alerts + password reset delivery) via a provider behind one server-only adapter; default **Resend**. Dev fallback logs to server console (never to client). |
| A4 | Sensitive-field set encrypted at app level: Aadhaar number, PAN, bank/account numbers, and any `fields` row flagged `is_sensitive`. Address and DOB are stored plaintext but are gated by privacy flags + grant scope (never returned outside a grant). |
| A5 | A visitor session lives 15 min by default, owner-configurable per grant (not extendable by the visitor); code validity 5 min default, 1–30 min range. |
| A6 | SVG uploads are **rejected** (the brief permits "reject or sanitize"; rejecting is the smaller attack surface). Images: PNG/JPEG/WebP/HEIC/AVIF only. |
| A7 | `NEXT_PUBLIC_SITE_URL` is left blank in `.env.example`; local/test env uses `https://id.example.invalid`. The build fails on missing/blank/invalid value. Real domain is entered once in Vercel. |
| A8 | Two-factor = Supabase Auth MFA (TOTP). Recovery codes: 10 one-time codes stored **hashed** in our own table (owner-scoped), shown once. |
| A9 | Passkeys/WebAuthn = optional unlock layer on top of a valid owner session (Supabase Auth passkey support if the project has it enabled); graceful fallback to password. If the hosted project does not expose passkeys, the UI hides the feature and says so — no dead button. |
| A10 | "Coarse IP" = full IP hashed with `IP_HASH_SECRET` (HMAC-SHA256, truncated). Raw IPs are never stored or logged. |
| A11 | The dashboard is a single-owner app: no roles, no sharing between owners, no multi-tenancy UI. RLS is still written generically (`owner_id = auth.uid()`) so a second user can be tested. |
| A12 | `docs/` + `SETUP.md` + `WALKTHROUGH.md` are deliverables; nothing else is added to the repo root. |
| A13 | Backups are exported on demand (JSON/CSV + ZIP), passphrase-encrypted AES-256-GCM. No scheduled jobs in v1. |

---

## 2. Scope / non-goals

**In scope** — everything in the brief: identity card (front/back) with one permanent QR, one-time-code access gate, owner dashboard, document vault, information manager, share links, security hardening, tests, docs.

**Non-goals (v1)** — multi-user support, native mobile apps, public marketing pages, notification centre, offline mode, i18n, analytics, third-party integrations. Hard Rule #1's content deny-list applies everywhere (see §20).

---

## 3. Architecture

```
Visitor ──QR──► /p/<slug>            (static lock screen, zero profile data, no-store, noindex)
                   │  POST access code
                   ▼
              verify (server) ──► consume_access_code()  [Postgres, SECURITY DEFINER, atomic]
                   │  sets signed httpOnly visitor cookie (bound to grant + slug)
                   ▼
              /p/<slug>/profile  ──► get_granted_profile(grant, slug)  [DB-side whitelist]
              /p/<slug>/contact.vcf

Owner ──► /login (Supabase Auth, OWNER_EMAIL allow-list, rate-limit, Turnstile, optional TOTP)
            │
            ▼
        /dashboard/{,card,access,vault,info,share,backup,settings}
            │  server actions: zod → owner check → RLS client (user session)
            ▼
        Supabase Postgres (RLS everywhere) + private Storage bucket
            │
            └─ service-role client used ONLY server-side, for: atomic code consume, audit/access-log
               writes, signed URL minting, alerts, seeding — never in the browser.
```

Two Supabase clients, strictly separated:
- `createUserClient()` — anon key + user session cookies. **All owner CRUD.** RLS applies.
- `createServiceClient()` — service-role key, imported only by `src/lib/db/service.ts`, guarded by an ESLint rule + a test that greps for its import outside the allow-list.

---

## 4. Data model

All tables in `public`, all with `owner_id uuid not null references auth.users(id) on delete cascade`, all with RLS enabled and forced.

### 4.1 Tables

**profiles** (1 row per owner — enforced `unique(owner_id)`)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_id | uuid unique not null | |
| slug | text not null unique | `check (slug ~ '^[a-z2-7]{16}$')` — 80 bits, Crockford-ish base32, from `crypto.randomBytes(10)`. Never derived from name/email. Immutable (§8). |
| full_name | text not null | |
| dob | date | shown only if `show_dob` **and** grant scope = full |
| address | text | shown only if `show_address` **and** scope = full |
| photo_path | text | storage object path `<owner_id>/<uuid>-<safe>.png` |
| show_dob / show_address / show_photo | boolean not null default **false** | privacy by default |
| is_active | boolean not null default true | owner kill switch |
| created_at / updated_at | timestamptz | `updated_at` via trigger |

**fields** (information manager rows)
| column | type | notes |
|---|---|---|
| id, owner_id | uuid | |
| kind | text | `check (kind in ('email','phone','address','family_contact','emergency_contact','important_date','note','account_record','custom'))` |
| label, value | text | `value` null when encrypted |
| value_encrypted | bytea | AES-256-GCM envelope (§10) for `is_sensitive` rows |
| is_sensitive | boolean not null default false | |
| is_public | boolean not null default false | DB-enforced: `check (not is_public or kind in ('email','phone'))` → only emails/phones can ever reach a visitor |
| sort | int not null default 0 | |

**categories** — `id, owner_id, name, sort, is_system, created_at`, `unique (owner_id, lower(name))`.
14 system categories seeded idempotently on first owner login (Aadhaar Card, PAN Card, Passport, Driving License, Birth Certificate, Educational Documents, Marksheets and Degrees, Bank Documents, Financial Documents, Government Documents, Medical Documents, Family Documents, Personal Photos, Other). Custom categories unlimited.

**documents** — `id, owner_id, category_id (null, on delete set null), name, storage_path, mime, size, sha256, created_at, updated_at`.

**share_links** — `id, owner_id, document_id (on delete cascade), token_hash unique, password_hash (argon2id, nullable), expires_at, max_downloads (nullable, >0), download_count default 0, revoked_at, created_at, last_accessed_at`.

**access_grants** — `id, owner_id, code_hash unique, scope check in ('contact','full'), expires_at (code validity), used_at, session_expires_at, revoked_at, created_at`.
`code_hash` is unique **globally** (stronger than "unique among active grants"); generation retries on conflict.

**access_log** (append-only) — `id, owner_id, grant_id null, slug, outcome check in ('granted','invalid','expired','used','revoked','rate_limited','locked','session_view','session_end'), ip_hash, user_agent (≤200), created_at`.
Counters for rate limiting are derived from this table by time window — no mutable counters to race on.

**lockouts** — `scope check in ('slug','email','ip','share'), key_hash, locked_until, created_at`, `pk (scope,key_hash)`.

**auth_attempts** — `id, email_hash, ip_hash, success, created_at` (window counts for the password rules).

**audit_log** (append-only) — `id, owner_id, actor check in ('owner','visitor','system'), action, entity_type, entity_id, detail jsonb, ip_hash, user_agent, created_at`. `detail` never contains sensitive values (§13).

**owner_settings** — `owner_id pk, default_scope, default_validity_minutes, visitor_session_minutes, alert_on_new_device, alert_on_lockout, totp_enabled, updated_at`.

**backup_recovery_codes** — `id, owner_id, code_hash, used_at, created_at` (2FA recovery codes).

### 4.2 Append-only enforcement
`access_log` and `audit_log` have **no** UPDATE/DELETE policies plus a `before update or delete` trigger raising an exception, so even the service role cannot rewrite history through the API.

### 4.3 DB functions (all `SECURITY DEFINER`, `search_path` pinned, `EXECUTE` revoked from `public, anon, authenticated`, granted to `service_role`)
| function | purpose |
|---|---|
| `consume_access_code(p_slug, p_code_hash, p_session_minutes)` | one transaction: resolve active profile → lockout check → window counters → select grant `FOR UPDATE` (`used_at is null and revoked_at is null and expires_at > now()`) → stamp `used_at`/`session_expires_at` → write `access_log` → return a small verdict object. Exactly-once, replay-proof. |
| `get_granted_profile(p_grant_id, p_slug)` | validates grant (used, not revoked, session not expired, profile `is_active`) and returns **only** the whitelisted projection: name + (emails/phones with `is_public`) + full scope adds photo/dob/address when their `show_*` flag is on. Never touches `is_sensitive` rows or documents. |
| `record_access_event(...)` | append log row. |
| `check_lockout(scope, key_hash)` / `note_failure(...)` | windows + lockout bookkeeping, incl. "invalidate all outstanding codes on slug lockout". |
| `seed_categories(p_owner)` | idempotent 14-category seed. |
| `guard_slug_immutable()` | trigger fn (§8.5). |

`DROP FUNCTION IF EXISTS public_profile(...)` is included in migration 0001 (defensive: the brief says it must not exist/callable).

### 4.4 Indexes
`profiles(slug)`, `fields(owner_id, kind, sort)`, `documents(owner_id, category_id, name)`, `share_links(token_hash)`, `access_grants(code_hash)`, `access_grants(owner_id, created_at desc)`, `access_log(owner_id, created_at desc)`, `access_log(slug, ip_hash, created_at desc)`, `audit_log(owner_id, created_at desc)`, `lockouts(pk)`, full-text index on `documents.name` + `fields.label/value` for global search.

---

## 5. Route map

### Public / visitor
| Route | Auth | Notes |
|---|---|---|
| `/` | — | Neutral: app name + "Sign in". No owner data. |
| `/p/[slug]` | none | **Lock screen only.** `no-store`, `noindex`, CSP nonce, zero profile data in HTML/RSC payload. |
| `/p/[slug]` (server action `unlock`) | none | Verifies code (zod, Turnstile-free, rate-limited), sets visitor cookie. Identical error copy for wrong/expired/used. |
| `/p/[slug]/profile` | visitor cookie | SSR fetch via `get_granted_profile`; countdown; tap-to-call / mailto / `wa.me` / Save contact. |
| `/p/[slug]/contact.vcf` | visitor cookie | vCard 3.0, `Content-Disposition: attachment`, `no-store`. 401 without a valid session. |
| `/s/[token]` | optional password | Share-link landing; password form when protected. |
| `/s/[token]/download` | token | Mints a **≤60 s** signed URL, then redirects. Rate-limited. |
| `/api/qr` | none (owner-independent) | Renders QR from `${NEXT_PUBLIC_SITE_URL}/p/<slug>` on demand; `?format=svg\|png&size=1024\|3000`. Deterministic; no QR image is stored. |

### Auth
`/login`, `/auth/forgot`, `/auth/reset`, `/auth/callback` (code exchange), `/auth/signout`.

### Dashboard (owner only: session + `OWNER_EMAIL` re-checked server-side on every route/action)
| Route | Purpose |
|---|---|
| `/dashboard` | Overview: card preview, storage usage, recent uploads, recent access, quick "Give access". |
| `/dashboard/card` | Card editor (DB-backed) + PNG/PDF exports, bleed variant, QR downloads (PNG 1024 / SVG / PNG 3000). |
| `/dashboard/access` | **Give access** (large button) → scope + validity → 8-digit code, countdown, copy, Revoke. Grants table (created / scope / expires / status) + access log. |
| `/dashboard/vault` | Documents: upload (drag & drop), categories, preview, rename, move, delete, search, share links, storage usage. |
| `/dashboard/info` | Information manager: emails, phones, addresses, family & emergency contacts, important dates, notes, account records — each with its own privacy toggle. |
| `/dashboard/share` | All share links: expiry, password, download count, revoke. |
| `/dashboard/backup` | Export DB (JSON/CSV) + ZIP of files, passphrase-encrypted. Restore instructions. |
| `/dashboard/settings` | Change password, email, active sessions + "sign out of all devices", TOTP + recovery codes, passkeys, privacy defaults, alert preferences. |
| `/dashboard/search` | Global search across documents + records. |

Re-authentication (`reauth_at` cookie, 5-min TTL, server-verified) is required for: revealing sensitive values, exports/backups, creating share links, changing password/email, bulk delete, and issuing access codes.

---

## 6. RLS policy table

RLS **enabled and forced** on every table in `public`. Every policy is `auth.uid()`-scoped; IDOR protection is `owner_id = auth.uid()` on read *and* every mutation, plus UUID PKs, plus every service-role lookup filtering `owner_id`.

| Table | anon | authenticated (owner) | Notes |
|---|---|---|---|
| profiles | ✗ | SELECT/INSERT/UPDATE where `owner_id = auth.uid()` | No DELETE policy (row is permanent; kill switch = `is_active`). `slug` additionally locked by trigger. |
| fields | ✗ | SELECT/INSERT/UPDATE/DELETE, `owner_id = auth.uid()` | |
| categories | ✗ | all four | `is_system` rows: DELETE blocked by trigger. |
| documents | ✗ | all four | |
| share_links | ✗ | all four | Public resolution happens server-side with service role after token hash match. |
| access_grants | ✗ | SELECT/INSERT/UPDATE (revoke only) | No DELETE. Visitor never touches the table. |
| access_log | ✗ | SELECT own | INSERT only via `SECURITY DEFINER` fn. No UPDATE/DELETE anywhere. |
| audit_log | ✗ | SELECT own | Same. |
| owner_settings | ✗ | SELECT/INSERT/UPDATE | |
| backup_recovery_codes | ✗ | SELECT (metadata) / DELETE | Insert via service role only. |
| auth_attempts, lockouts | ✗ | ✗ (no policy at all) | service_role only. |
| storage.objects (bucket `documents`, private) | ✗ | SELECT/INSERT/UPDATE/DELETE only when `bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text` | No public bucket, ever. Visitors get ≤60 s signed URLs minted server-side. |

**Verification (required):** user B cannot read/write user A's rows or files; anon cannot select any table nor execute any function.

---

## 7. Access gate

### 7.1 State machine
```
        created ──► active ──(code consumed)──► used ──(session_expires_at)──► expired
           │           │                              
           │           ├──(expires_at passes)──► expired (unusable)
           └───────────┴──(owner revokes)──────► revoked (session dies instantly)

slug lockout (10 bad attempts/15 min) ──► all outstanding codes revoked + owner email alert
```
Visitor cookie: `vz_v_<slug8>` = `base64url({gid, slug, exp}) + "." + HMAC-SHA256(SESSION_COOKIE_SECRET, payload)`; `httpOnly; Secure; SameSite=Lax; Path=/p/<slug>`; 15 min default, never extendable by the visitor. Every request re-validates signature → expiry → grant (`revoked_at is null`, `session_expires_at > now()`) → profile `is_active` → slug match, then fetches data server-side.

### 7.2 Numeric rules (enforced server-side; identical response for wrong/expired/used)
| Rule | Window | Effect |
|---|---|---|
| 5 wrong attempts / slug / IP | 10 min | further attempts rejected for the remainder of the window |
| 10 wrong attempts / slug (any IP) | 15 min | 15-min lockout, **all outstanding codes for that slug revoked**, owner alert emailed |
| Password: 5 failures / email and 5 / IP | 15 min | 15-min lockout, owner alert |
| Password: ≥3 failures | — | Cloudflare Turnstile required |
| Share-link password: 5 failures / token / IP | 15 min | blocked for window |

### 7.3 Owner "Give access"
Scope `contact` (name + public emails/phones) or `full` (+ photo, DOB, address, each only if its `show_*` flag is on). Validity 1–30 min (default 5). Code: `crypto.randomInt(0, 10**8)` zero-padded to 8 digits; stored only as `HMAC-SHA256(ACCESS_CODE_SECRET, slug + ':' + code)`; uniqueness retried on conflict; compare with `crypto.timingSafeEqual` on fixed-length buffers. UI shows countdown + copy + revoke, and re-auth is required before issuing.

---

## 8. QR permanence invariants (the QR must never change)

| # | Invariant | Enforcement |
|---|---|---|
| 8.1 | QR payload is exactly `${NEXT_PUBLIC_SITE_URL}/p/${slug}`; never `window.location`, preview URL, per-person link, code, or user data. | One module `src/lib/qr/payload.ts` builds it from `env.NEXT_PUBLIC_SITE_URL` + DB slug only. |
| 8.2 | Build fails if `NEXT_PUBLIC_SITE_URL` is missing/blank/invalid. | `src/lib/env.ts` (zod, `.url()`, `startsWith('https://')`) imported by `next.config.ts` + `instrumentation.ts`; also asserted in a unit test that runs in `prebuild`. |
| 8.3 | Slug created once at first profile creation, 16 chars base32 from CSPRNG, never name/email-derived. | `check` constraint + generator + test that slug ≠ any hash/derivation of name/email. |
| 8.4 | No regenerate/rotate/per-visitor QR anywhere (UI or API). | No such route/action exists; `grep` assertion test in the test suite. |
| 8.5 | Updates use explicit column lists that exclude `slug`; never delete+insert; never upsert including `slug`. | Repo-wide pattern test + `guard_slug_immutable()` trigger `before update on profiles` raising `slug is immutable`. |
| 8.6 | No QR image is stored; rendered on demand. | No storage write path for QR; `/api/qr` renders from the payload. |
| 8.7 | None of the listed actions can change the QR. | Byte-for-byte test (§18.4) drives every listed action. |
| 8.8 | Owner kill switch `is_active` disables the profile without changing the QR. | Gate functions check `is_active`; slug untouched. |
| 8.9 | QR renderer settings fixed: EC level **H**, quiet zone ≥ 4 modules, deterministic byte output. | Single `renderQr()` config object; snapshot test asserts byte-identical output across runs. |

---

## 9. Route-level security baseline

- **Headers** (middleware + `next.config.ts`): `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`, `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per-request>'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' <supabase>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` on `/p/*`, `/s/*`, `/api/*`, vCard.
- **CSRF**: Next server actions (origin-checked) + `SameSite=Lax` cookies; no state-changing GET; strict CORS (same-origin only) on any route handler.
- **Input**: zod on every server action and route handler; outputs escaped; `dangerouslySetInnerHTML` banned by lint rule (QR SVG is emitted from a route handler as a string, never injected into the DOM; in-page QR is built as React `<rect>` elements).
- **Sessions**: httpOnly, Secure, SameSite=Lax; idle timeout 30 min; absolute 7 days; "sign out of all devices"; password change/reset revokes all other sessions; active-session list.
- **Logging**: a `redact()` helper + lint ban; no sensitive value, code, password, token or cookie ever logged; error responses carry a correlation id only.

---

## 10. Cryptography & keys

| Purpose | Algorithm | Key source | Format |
|---|---|---|---|
| Access code at rest | HMAC-SHA256(slug + ':' + code) | `ACCESS_CODE_SECRET` | hex, unique |
| Owner-session cookie signature | HMAC-SHA256 | `SESSION_COOKIE_SECRET` | base64url |
| Sensitive fields | AES-256-GCM, 12-byte random nonce, AAD `owner_id:entity_id:column` | `FIELD_ENCRYPTION_KEYS` (keyring) + `FIELD_ENCRYPTION_ACTIVE_KEY` | `v1.<keyid>.<nonce>.<ct>.<tag>` |
| Share-link token | 32 random bytes, stored as SHA-256 | — | base64url |
| Share-link password | argon2id (fallback bcrypt verify for legacy) | — | PHC string |
| Backup bundle | AES-256-GCM, key = scrypt(passphrase, salt, N=2¹⁵) | owner passphrase (in-browser→server, never stored) | `.vzbak` header + ciphertext |
| IP pseudonymisation | HMAC-SHA256, truncate 12 bytes | `IP_HASH_SECRET` | hex |

**Rotation (documented in SETUP.md + `docs/key-rotation.md`)**: add new key to the keyring, flip `FIELD_ENCRYPTION_ACTIVE_KEY`, then a `rotate-keys` script re-encrypts rows written under the old id (idempotent, resumable, dry-run flag). Rotation never touches `slug`, so the QR is unchanged.

---

## 11. Upload pipeline

1. Client requests a target path from a server action (validates extension/MIME/size against `MAX_UPLOAD_MB`, default 50).
2. Bytes go to `<owner_id>/<uuid>-<safe-name>` in the private `documents` bucket via an authenticated upload (RLS folder policy).
3. Server re-validates by **content sniffing** (magic bytes) against the declared MIME; mismatches and any executable/script/SVG payload are deleted and rejected; then `sha256` + metadata row are written.
4. Serving: owner preview via ≤60 s signed URL; visitors never touch storage; share downloads via `/s/[token]/download` with `Content-Disposition: attachment` + a typed `Content-Type`, never `public` URLs.

---

## 12. Alerts & email

Server-only adapter (`src/lib/mail/`), provider-agnostic: owner lockout, access-gate lockout, successful login from a new device/browser (device fingerprint = UA + coarse platform hash, stored hashed), password changed/reset, new share link created, backup exported, 2FA enabled/disabled. Send failures are logged (redacted) and never block the request. No PII beyond what the alert needs.

---

## 13. Audit log & "no sensitive in logs"

Logged: logins (success/failure), reveals, exports/backups, share-link create/revoke/use, access-grant create/revoke/use, settings changes, 2FA changes. `detail` stores identifiers and outcome enums only — masked display (`••••1234`) is computed at read time. A test asserts a seeded marker value for every sensitive field never appears in `audit_log.detail`, `access_log`, or captured console output.

---

## 14. Threat model

| # | Threat | Vector | Mitigation | Verified by |
|---|---|---|---|---|
| T1 | Credential stuffing | Leaked-password lists vs. owner email | Public sign-up disabled; single allow-listed email; per-email + per-IP windows; 15-min lockout; Turnstile after 3 failures; Supabase leaked-password protection + ≥12-char policy + local weak-password check; new-device alert | §18.2 |
| T2 | Password brute force | Automated POSTs | Same as T1 + generic error copy; hash-based lockout keys; constant-shape responses | §18.2 |
| T3 | Code brute force | 8 digits = 10⁸; ~10 tries/window | 5/IP/slug/10 min, 10/slug/15 min lockout, outstanding codes revoked on lockout, alert; identical error copy; `no-store` | §18.3f |
| T4 | Shoulder-surfing | Someone reads the code or the screen | 1–30 min validity (5 default), 8-digit code shown once with countdown, revoke button, profile returns to lock screen after 15 min, sensitive values masked by default | §18.3g + browser shots |
| T5 | Code sharing / forwarding | Visitor sends the code to a third party | Single-use atomic consume (`FOR UPDATE` + `used_at is null` guard) — second presentation fails; short validity; owner sees grant status `used` | §18.3c |
| T6 | Replay of a used/expired code | Re-POST the same code | Consume is one transaction; used/expired/revoked all rejected; lock screen resets | §18.3c,d |
| T7 | Visitor session theft / fixation | Stolen or forged cookie | Signed httpOnly Secure SameSite=Lax cookie bound to grant + slug, server-verified per request; no client-issued identifiers; `no-store`; revoke kills it instantly | §18.3g,h |
| T8 | Owner session theft | XSS, CSRF, shared device | Strict CSP with nonces, no inline scripts, no `dangerouslySetInnerHTML`, `SameSite=Lax` + origin-checked actions, 30-min idle / 7-day absolute, "sign out of all devices", re-auth (5 min) for sensitive actions | §18.2, §18.5 |
| T9 | IDOR | Guessing/altering UUIDs | RLS `owner_id = auth.uid()` on every read/write; UUID PKs; every service-role query also filters `owner_id`; share/grant resolution by hash, not by id | §18.1 |
| T10 | Privilege escalation via DB functions | anon calling `get_granted_profile` / `public_profile()` | All definer functions `REVOKE`d from `public, anon, authenticated`; `public_profile` dropped; `EXECUTE` only to `service_role` | §18.1 |
| T11 | Profile enumeration / slug guessing | Scanning `/p/<slug>` | 80-bit slug; uniform lock-screen response and timing; attempts logged; lockout | §18.3b |
| T12 | PII leakage through HTML/RSC/cache | View-source, RSC payload, CDN cache | Lock screen renders zero profile data; `no-store`, `noindex`; data fetched only after grant check | §18.3a |
| T13 | Malicious upload / stored XSS | Crafted PDF/SVG/office file | MIME + extension allow-list, magic-byte sniffing, SVG/executables rejected, `Content-Disposition: attachment`, no inline rendering of untrusted HTML, private bucket + short signed URLs | unit tests (§18.5) |
| T14 | Share-link abuse | Token guessing, password brute force, unlimited downloads | 256-bit token, stored hashed, expiry, argon2id password, download limit, revoke, attempt rate limit | §18.5 |
| T15 | Backup exfiltration | Stolen export bundle | Re-auth + passphrase-encrypted AES-256 bundle, alert on export, audited | §18.5 |
| T16 | Secret leakage | Keys in client bundle / git history | Only 4 `NEXT_PUBLIC_*` vars; server-only module + lint rule + bundle grep test; gitleaks in CI fails the build; no-secrets-in-git check | §18.5 |
| T17 | Dependency compromise | Malicious package update | Exact pinned versions, committed lockfile, `npm audit` gate, secret scan gate | §18.7 |
| T18 | Timing side channel | Comparing codes/passwords | HMAC comparison via `timingSafeEqual`, fixed-length buffers, argon2 column, uniform failure copy | unit tests |
| T19 | DoS on the unlock endpoint | Flooding verify | Rate windows + lockout, cheap HMAC path, no DB-heavy work before validation, Turnstile available at the gate if enabled | §18.3f |
| T20 | Lost/stolen device | Unattended dashboard | 30-min idle timeout, re-auth before sensitive actions, TOTP + passkey unlock, "sign out of all devices", session list | §18.2 |
| T21 | Fake QR sticker / phishing clone | Attacker prints a look-alike card pointing elsewhere | Card documents the canonical domain; QR payload is fixed and asserted byte-for-byte; the lock screen shows only the code prompt (no data), so a clone yields nothing without an owner-issued code | §18.4 |
| T22 | Owner error (over-exposure) | Toggling the wrong privacy flag | Privacy defaults all `false`; only emails/phones can be marked public (DB check); a `full` grant still cannot reach sensitive rows, notes, accounts or documents (DB-enforced projection) | §18.3i,j |

---

## 15. Workstream split (parallel after approval, disjoint file ownership)

| WS | Scope | Owned paths |
|---|---|---|
| **A** | DB, RLS, storage policies, slug trigger, grants/logs, atomic consume, field encryption, audit, SQL tests | `supabase/**`, `src/lib/db/**`, `src/lib/crypto/**`, `scripts/db-test.mjs` |
| **B** | Auth: login, forgot/change password, rate limit + Turnstile, sessions, re-auth, TOTP, passkeys, alerts | `src/lib/auth/**`, `src/lib/rate-limit.ts`, `src/lib/mail/**`, `src/app/(auth)/**`, `src/app/api/auth/**`, `middleware.ts` |
| **C** | Card + QR: card component/edit, QR endpoints, PNG/SVG/PDF exports, print | `src/components/card/**`, `src/lib/qr/**`, `src/lib/export/**`, `src/app/api/qr/**`, `src/app/dashboard/card/**` |
| **D** | Access gate: lock screen, verify, visitor cookie, limiter/lockout, gated profile, vCard, owner Give access + Access pages | `src/app/p/**`, `src/components/access/**`, `src/lib/access/**`, `src/app/dashboard/access/**` |
| **E** | Vault: upload, categories, preview, rename, move, delete, search, share links, usage | `src/app/dashboard/vault/**`, `src/app/s/**`, `src/lib/storage/**`, `src/lib/share/**`, `src/app/dashboard/share/**` |
| **F** | Information manager: all field kinds, per-field privacy toggle, encryption binding | `src/app/dashboard/info/**`, `src/components/fields/**`, `src/lib/fields/**` |
| **G** | Shell + QA: layout/nav, global search, backup/export, e2e + browser verification, Lighthouse, deny-list scan | `src/app/layout.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/{search,backup}/**`, `src/components/ui/**`, `tests/**`, `src/lib/backup/**`, `scripts/**` |

**Freeze first (WS A, everyone imports, nobody else edits):** `src/lib/types.ts`, `src/lib/env.ts`, `src/lib/crypto/*`, `src/lib/db/{user,service}.ts`, `src/lib/result.ts`.
**QA harness is the AI agent's own workstream** — each workstream supplies its own unit tests; WS G owns cross-cutting e2e, browser flows, and the verification report.

Dependency order: A (schema + shared libs) → B/C/D/E/F in parallel → G (e2e + docs). G scaffolds the shell during A.

---

## 16. Environment variables

`NEXT_PUBLIC_*` (4 only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, `ACCESS_CODE_SECRET`, `SESSION_COOKIE_SECRET`, `FIELD_ENCRYPTION_KEYS`, `FIELD_ENCRYPTION_ACTIVE_KEY`, `IP_HASH_SECRET`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_TO_EMAIL`, `MAX_UPLOAD_MB`, `SHARE_LINK_TTL_MINUTES`.

`src/lib/env.ts` validates everything at startup (zod) and fails fast; a test asserts no server-only value appears in `.next/static`. `.env.example` lists names + how to generate each value (`openssl rand -base64 32`), never real secrets. `.gitignore` covers `.env*` (except the example).

---

## 17. Deliverables

Working code · `supabase/schema.sql` + `supabase/migrations/*.sql` · tests (unit, SQL/RLS, e2e, browser) · `.env.example` · `SETUP.md` (Supabase project, Vercel, custom domain, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`, code-hash secret, field-encryption key + rotation, Turnstile, disabling sign-ups, creating the owner user, leaked-password protection, 2FA, add-to-home-screen) · `WALKTHROUGH.md` (what was verified, what failed, what needs you) · `PLAN.md` + `TASKS.md` (these).

---

## 18. Verification plan (nothing is claimed unless executed)

| § | Test | How it runs here |
|---|---|---|
| 18.1 | RLS: user B cannot read/write A's rows or files; anon cannot select any table or execute any function | SQL script (`scripts/db-test.mjs`, Node `pg`, no Docker needed) against the Supabase target from §19-Q1; falls back to local Postgres + `auth` shim if you prefer |
| 18.2 | Auth: sign-up off; identical wrong-password/unknown-email copy; 5 failures lock out; idle + absolute expiry; password change signs out others; re-auth required for each sensitive action; reset link single-use + expiry | Vitest against the user client + SQL assertions; TOTP/reset-email delivery verified live on the target project |
| 18.3 | Gate a–k (no data in HTML via curl; one-time code; reuse fails; expiry fails; wrong = same copy; 5/10 thresholds + lockout revokes codes; session expiry returns the lock screen; revoke ends session; contact-scope never returns photo/DOB/address; no scope returns sensitive/notes/accounts/documents; vCard 401 without session) | curl + Vitest + Playwright |
| 18.4 | QR permanence: capture QR SVG → run every action from invariant §8.7 → byte-for-byte identical | Playwright + Vitest snapshot + DB state assertions |
| 18.5 | Headers; `npm audit`; secret scan; ciphertext unreadable in raw DB; no sensitive values in logs; no secret in client bundle | curl -I, npm audit, gitleaks, SQL ciphertext check, log capture test, `.next/static` grep |
| 18.6 | Browser flows with screenshots: login, give access + code display, mobile-viewport visitor unlock, drag-and-drop upload, rename, download, share link with password + expiry | Playwright (chromium via proxy) against a local production build |
| 18.7 | Typecheck, lint, build, e2e — output shown to you | `tsc --noEmit`, `eslint`, `next build`, `playwright test` |
| 18.8 | Deny-list scan (Hard Rule #1) + gold-colour scan (the literal list in `tests/fixtures/palette-banned.txt`, plus every warm-yellow hex by HSL analysis) | `scripts/scan-deny-list.mjs` + `scripts/scan-colors.mjs`; reported verbatim |
| 18.9 | Lighthouse ≥ 90 performance on the lock screen | `lighthouse` on the local production build |

Honest limits (called out in `WALKTHROUGH.md`): no Docker in this sandbox, no Vercel account, no custom domain, so **deployed** HTTPS/HSTS behaviour, real push to Vercel, and live email delivery depend on the §19 answers / your action. Everything runnable locally is run and its raw output pasted into the report.

---

## 19. Blocking questions (2) + what I will do without an answer

**Q1 — Where do RLS/Auth integration tests run?** Docker is not available in this sandbox.
- (a) You provide a dedicated **Supabase test project** (URL + anon + service-role keys, no real data) → I run migrations and all of §18.1–18.3 against real Supabase.
- (b) I install local Postgres and run real SQL-level tests (RLS, slug trigger, atomic consume, lockout windows, encryption-at-rest) with an `auth` shim, and mark Supabase-Auth/Storage behaviours as **unverified** until you point me at a project.
- (c) Skip integration tests (I would then report §18.1–18.3 as **not verified**).

**Q2 — Transactional email provider for alerts/reset?** Resend (default, `RESEND_API_KEY`) · SMTP via env · Supabase Auth's own email for resets + log-only alerts in dev.

If you don't answer, I proceed with **Q1(b)** and **Q2 = Resend + dev log fallback**, and mark the affected checks as unverified in `WALKTHROUGH.md`.

---

## 20. Hard-rule enforcement (built-in, checked before finishing)

- **Hard Rule #1 content deny-list** applies to UI copy, seed data, placeholders, metadata, README, tests and the data model — the schema has no such column, and free-text fields are labelled neutrally. Enforced by a repo-wide scan against `tests/fixtures/banned-terms.txt` (the **only** file permitted to contain those words; the final report names it as the single permitted hit) and by a test that fails the build on any other occurrence.
- **No placeholder or dead content**: every control is wired to a real query or action; empty states are real empty states. A test walks the dashboard routes and fails on any pattern listed in `tests/fixtures/placeholder-terms.txt` (filler text, unfinished-task markers, dead anchors) and on disabled-but-unexplained buttons.
- **No gold**: colour tokens live in one file; only `#FFFFFF`, `#F3F4F6`, `#E5E7EB`, `#DDE1E7`, `#5B6472`, `#111827` and one dark accent. Scan fails on any gold-family hex.
- **No secrets in git**: `.env*` ignored, gitleaks gate, `.env.example` contains names only.
