# Task List — Private Identity Card + Document Vault

Legend: `WS` = workstream from `PLAN.md` §15 · **Gate** = must pass before dependent tasks start.
Nothing below starts until the plan is approved.

---

## Progress log

| When | What | Evidence |
|---|---|---|
| Phase 0 | Scaffold, env contract, tokens, shared contracts. | `npm run build` green |
| Phase 1 | Schema + RLS + definer functions applied to the live Supabase project. | `node scripts/db-test.mjs` → **16/16 passed** |
| Phase 1 fix | `access_log.grant_id` FK changed from `on delete set null` to NO ACTION: a SET NULL cascade was an UPDATE on an append-only table, so deleting a grant always failed. | A-T5 now asserts the grant cannot be deleted while the log references it |
| Phase 3 | Card component, QR render/download, PNG+PDF export (300 DPI, bleed), `/dashboard` shell, DB-backed card editor + photo upload. | `npm run typecheck`, `npm run lint`, `npm run build`, `npm run scan:deny-list` (clean), `npm run scan:colors` (clean) |
| Blocked | Not run yet: live auth, access gate, vault, info manager, browser + Lighthouse checks, GitHub push. | See “Needs your input” in the walkthrough |


---

## Phase 0 — Decisions & scaffolding

| ID | Task | WS | Output / Gate |
|---|---|---|---|
| P0-1 | Confirm §19 answers (test target, email provider). | — | Gate for P5-*, B-4, B-8 |
| P0-2 | Scaffold Next.js 15 + TS strict + Tailwind v4 + shadcn/ui, exact-pinned deps, committed lockfile, ESLint/Prettier/Vitest/Playwright config. | G | `npm run dev/build` works |
| P0-3 | `src/lib/env.ts` zod validation + startup fail-fast + `NEXT_PUBLIC_SITE_URL` build gate (invariant 8.2). | A | Unit test: missing URL fails build |
| P0-4 | `.env.example` (names only, generation instructions) + `.gitignore` + gitleaks config + CI workflow stub. | G | `gitleaks detect` runs |
| P0-5 | Freeze shared contracts: `src/lib/types.ts`, `src/lib/result.ts`, `src/lib/db/{user,service}.ts`, `src/lib/crypto/*`. | A | Gate for B/C/D/E/F |
| P0-6 | Design tokens + base theme (whites/greys/ink, one dark accent, Manrope). | G | No gold-family hex |

## Phase 1 — Database & security core (WS A — gate for everything)

| ID | Task | Owner | Verification |
|---|---|---|---|
| A-1 | `supabase/migrations/0001_init.sql`: all tables from `PLAN.md` §4.1 with constraints incl. `check (not is_public or kind in ('email','phone'))` and slug regex. | A | Migration applies clean |
| A-2 | Enable **and force** RLS on every table + full policy set per §6. | A | SQL test §18.1 |
| A-3 | Storage bucket `documents` (private) + folder-scoped policies `<uid>/...`. | A | SQL test §18.1 |
| A-4 | `guard_slug_immutable()` trigger: `before update on profiles` raising on slug change; plus revoke `UPDATE(slug)` column grant. | A | Test A-T3 |
| A-5 | `consume_access_code()` atomic, exactly-once (row lock + `used_at is null`). | A | Test A-T5 |
| A-6 | `get_granted_profile()` DB-side whitelist projection (§4.3). | A | Tests A-T6 |
| A-7 | `check_lockout()` / `note_failure()` incl. revoking outstanding codes on slug lockout. | A | Test A-T4 |
| A-8 | Append-only triggers on `access_log`, `audit_log`; system-category delete guard. | A | Test A-T7 |
| A-9 | `seed_categories()` (14 defaults, idempotent) + custom categories. | A | Test A-T8 |
| A-10 | AES-256-GCM field crypto + keyring + envelope format + `rotate-keys` script + `docs/key-rotation.md`. | A | Unit + §18.5 ciphertext check |
| A-11 | `drop function if exists public_profile(...)`; revoke `EXECUTE` on all definer fns from `public, anon, authenticated`. | A | Test A-T2 |
| A-12 | Indexes per §4.4 + FTS index. | A | Migration applies |
| A-13 | `scripts/db-test.mjs` runner (Node `pg`, no Docker) + SQL test suite A-T1…A-T9. | A | Exit code 0 |
| A-14 | `supabase/schema.sql` consolidated snapshot + `supabase/seed.sql`. | A | Re-applies on empty DB |

**WS A tests**: A-T1 two-user RLS isolation · A-T2 anon cannot select/execute · A-T3 slug-change raises · A-T4 rate windows + lockout revokes codes · A-T5 exactly-once consume under concurrency · A-T6 scope projection (contact vs full vs nothing) · A-T7 append-only + system category guard · A-T8 seed idempotency · A-T9 encrypted columns unreadable raw.

## Phase 2 — Auth (WS B, parallel)

| ID | Task | Verification |
|---|---|---|
| B-1 | Supabase clients + middleware: session refresh, idle 30 min / absolute 7 d, CSP nonce, `no-store` on `/p/*` + `/s/*`, security headers. | Header curl + §18.2 |
| B-2 | `/login` (email+password, password-manager autocomplete, paste allowed), generic error copy, `OWNER_EMAIL` allow-list, sign-up disabled. | B-T1 |
| B-3 | Password policy: ≥12 chars, local weak/common check, strength meter, Supabase leaked-password protection. | B-T2 |
| B-4 | Rate limiting: 5/email + 5/IP per 15 min → 15-min lockout; Turnstile after 3 failures; lockout alert email. | B-T3 |
| B-5 | Forgot password → single-use emailed link, 30-min expiry; change password in dashboard; both revoke other sessions. | B-T4 |
| B-6 | Session list, "Sign out of all devices", new-device alert email. | B-T5 |
| B-7 | Re-auth gate (5-min TTL cookie) enforced on every sensitive action listed in §5. | B-T6 |
| B-8 | Optional TOTP + 10 one-time recovery codes (hashed, shown once); passkey unlock with graceful fallback (no dead button). | B-T7 |
| B-9 | Alerts adapter + redaction helper + lint bans. | B-T8 |

## Phase 3 — Card & QR (WS C, parallel)

| ID | Task | Verification |
|---|---|---|
| C-1 | Card component: ID-1 85.60×53.98 mm, white, specified hexes, hairline borders, 3.2 mm radius, 8 px ink bars (front top / back bottom), faint concentric circles lower-right, Manrope 700/600/400 at spec sizes. | Visual + browser shot |
| C-2 | Front (photo, name, DOB, primary phone, primary email) / back (QR + "Scan, then enter the code I give you."), editable, DB-backed, privacy-flag aware. | C-T1 |
| C-3 | `src/lib/qr/payload.ts` — single source of the payload (invariant 8.1) + `renderQr()` fixed config (EC H, quiet zone ≥4). | C-T2 |
| C-4 | `/api/qr` on-demand PNG 1024 / SVG / PNG 3000, deterministic, stores nothing (8.6). | C-T3 |
| C-5 | Exports: PNG 1011×638 @300 DPI, PDF front/back, 3 mm bleed variant. | C-T4 |
| C-6 | No regenerate/rotate/per-visitor QR exist anywhere (8.4). | C-T5 grep assertion |

## Phase 4 — Access gate (WS D, parallel)

| ID | Task | Verification |
|---|---|---|
| D-1 | `/p/[slug]` lock screen: code input + "Enter the access code from the owner.", zero profile data in HTML/RSC, `no-store`, `noindex`, Lighthouse ≥90. | D-T1 (§18.3a) |
| D-2 | Lock-screen server action: zod, rate windows (5/IP/10 min), lockout (10/slug/15 min → revoke outstanding + alert), identical error copy. | D-T2 (§18.3f) |
| D-3 | Visitor session cookie (signed, httpOnly/Secure/Lax, path-scoped, 15 min, non-extendable) + per-request re-validation. | D-T3 (§18.3g) |
| D-4 | Gated profile page: scope-aware fields, tap-to-call, mailto, `wa.me`, countdown, mobile-first light theme. | D-T4 (§18.3i,j) |
| D-5 | vCard 3.0 `.vcf` route behind the same session check (401 otherwise, `no-store`, attachment). | D-T5 (§18.3k) |
| D-6 | Owner **Give access**: scope + validity (1–30 min), 8-digit `crypto.randomInt` code, countdown, copy, revoke, re-auth required. | D-T6 |
| D-7 | Grants table (created/scope/expires/status) + access log (time/outcome/coarse IP/UA) + instant revoke of grant or session. | D-T7 (§18.3h) |
| D-8 | Kill switch `is_active` disables profile without touching slug (8.8). | D-T8 |

## Phase 5 — Vault (WS E, parallel)

| ID | Task | Verification |
|---|---|---|
| E-1 | Upload: drag & drop, allow-list + magic-byte sniffing, size limit, SVG/executables rejected, sanitised path `<uid>/<uuid>-<safe>`. | E-T1 |
| E-2 | Categories (14 seeded, custom unlimited), rename, move, delete, search. | E-T2 |
| E-3 | Preview + download via ≤60 s signed URLs with `Content-Disposition`; never public URLs. | E-T3 |
| E-4 | Storage usage + recent uploads. | E-T4 |
| E-5 | Share links: 32-byte token (stored hashed), expiry, optional argon2id password, optional download limit, revoke, password attempt rate limit, `/s/[token]` + `/s/[token]/download`. | E-T5 (§18.5) |

## Phase 6 — Information manager (WS F, parallel)

| ID | Task | Verification |
|---|---|---|
| F-1 | CRUD for emails, phones, addresses, family contacts, emergency contacts, important dates, notes, account records, custom. | F-T1 |
| F-2 | Per-field privacy toggle; DB check restricts public exposure to emails/phones only. | F-T2 |
| F-3 | Sensitive binding: Aadhaar, PAN, account numbers encrypted at rest; masked `••••1234` display; logged reveal with fresh re-auth. | F-T3 (§18.5) |
| F-4 | Ownership/IDOR checks on every mutation (explicit `owner_id` filter). | F-T4 |

## Phase 7 — Shell & QA (WS G)

| ID | Task | Verification |
|---|---|---|
| G-1 | Dashboard shell: layout, nav, global search across documents + records, loading/error states for every async action, empty states. | Browser shots |
| G-2 | Backup/export: JSON/CSV + ZIP, passphrase-encrypted AES-256, re-auth required, alert + audit entry. | G-T1 |
| G-3 | Accessibility pass: visible focus, keyboard-only flows, WCAG AA contrast, labels. | axe + manual |
| G-4 | E2E suites §18.3, §18.4 (QR permanence incl. every action in 8.7), §18.6 browser flows with screenshots. | Raw output |
| G-5 | §18.5 security sweep: headers, `npm audit`, gitleaks, ciphertext check, log check, bundle check. | Raw output |
| G-6 | §18.7 typecheck, lint, build, e2e; §18.9 Lighthouse on lock screen. | Raw output |
| G-7 | §18.8 deny-list scan + gold-colour scan; report verbatim. | Raw output |
| G-8 | `SETUP.md` (Supabase, Vercel, custom domain, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`, secrets, Turnstile, sign-ups off, owner user, leaked-password protection, 2FA, home-screen install). | Review |
| G-9 | `WALKTHROUGH.md`: verified / failed / needs-your-action, with evidence and honest gaps. | Review |

---

## Definition of done

1. Every Phase 1–7 task checked, with the listed verification actually executed and its raw output attached.
2. All 8 verification groups in the brief run; anything unrunnable is labelled **not verified** with the reason.
3. Hard rules: the Hard Rule #1 deny-list appears only in `tests/fixtures/banned-terms.txt`; no placeholder or dead controls; no secret in client code or git; a visitor can never reach sensitive fields, notes, account records or documents.
4. One QR, byte-for-byte unchanged after the full §18.4 action list.
5. Typecheck, lint, build, unit, SQL and e2e all green.

## Stop conditions

If any fix fails twice, or a check cannot run because of a missing external resource, I stop, ask once, and report the blocker instead of retrying.
