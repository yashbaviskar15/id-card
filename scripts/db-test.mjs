#!/usr/bin/env node
/**
 * scripts/db-test.mjs — SQL-level verification of the database & security core.
 *
 * Runs the WS-A suite (A-T1…A-T9) against a Supabase project using a direct
 * Postgres connection, simulating `anon` / `authenticated` via `SET ROLE` and
 * `request.jwt.claims` (exactly how PostgREST does it). Everything runs inside
 * ONE transaction that is always rolled back, so no test data is left behind.
 *
 * Requires SUPABASE_DB_URL. When it is unset the suite SKIPS (exit 0) and says so,
 * so CI without a database does not silently pass a real run.
 *
 *   SUPABASE_DB_URL=postgres://... npm run test:db
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

// Load local env files when present. `process.loadEnvFile` throws on a missing
// file, so each candidate is probed first; values already in the environment win.
for (const file of ['.env.local', '.env']) {
  try {
    if (existsSync(file)) process.loadEnvFile(file);
  } catch {
    // ignore unreadable/duplicate env files
  }
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.log('[db-test] SKIP — SUPABASE_DB_URL is not set; nothing was verified.');
  process.exit(0);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

const results = [];
let current = null;

function record(ok, detail) {
  results.push({ name: current, ok, detail });
}

async function test(name, fn) {
  current = name;
  await client.query('savepoint t');
  try {
    await fn();
    record(true, '');
  } catch (e) {
    record(false, e.message);
    await client.query('rollback to savepoint t');
  }
  // `SET LOCAL ROLE` / `set_config` survive a savepoint rollback, so reset the
  // simulated identity deterministically after every case.
  await asPostgres();
  await client.query('release savepoint t');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function asRole(role, uid) {
  await client.query(`set local role ${role}`);
  const claims = uid ? JSON.stringify({ sub: uid, role }) : '{}';
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
}

async function asPostgres() {
  await client.query('reset role');
  await client.query(`select set_config('request.jwt.claims', '{}', true)`);
}

async function scalar(sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : null;
}

async function expectError(fn, pattern) {
  await client.query('savepoint e');
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
    if (pattern && !new RegExp(pattern, 'i').test(e.message)) {
      await client.query('rollback to savepoint e');
      throw new Error(`expected error matching /${pattern}/, got: ${e.message}`);
    }
  }
  if (!threw) {
    await client.query('rollback to savepoint e');
    throw new Error(`expected an error matching /${pattern || '.*'}/, but the statement succeeded`);
  }
  await client.query('rollback to savepoint e');
}

/**
 * Append-only logs must be cleared between cases, but a normal DELETE is (by
 * design) rejected. Only the table owner can bypass the guard, and the whole
 * suite runs in one transaction that is rolled back, so nothing persists.
 */
async function clearAppendOnly(table) {
  await client.query(`alter table public.${table} disable trigger user`);
  try {
    await client.query(`delete from public.${table}`);
  } finally {
    await client.query(`alter table public.${table} enable trigger user`);
  }
}

async function makeUser(email) {
  const id = randomUUID();
  await client.query(
    `insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
     values ($1, $2, 'authenticated', 'authenticated', now(), now(), now())`,
    [id, email],
  );
  return id;
}

const slugA = 'aaaaaaa2aaaaaaa2'; // 16 chars of [a-z2-7]
const slugB = 'bbbbbbb2bbbbbbb2';

let ownerA;
let ownerB;

try {
  // Everything below runs inside ONE transaction that is always rolled back —
  // including the fixture auth users (any earlier placement outside `begin`
  // would commit them into the real project).
  await client.query('begin');

  ownerA = await makeUser('owner-a@example.invalid');
  ownerB = await makeUser('owner-b@example.invalid');

  // --- fixtures (as postgres: RLS bypassed) --------------------------------
  await asPostgres();
  await client.query(
    `insert into public.profiles (owner_id, slug, full_name, dob, address, show_dob, show_address)
     values ($1, $2, 'Owner A', '1990-01-02', '1 Test Road', true, true)`,
    [ownerA, slugA],
  );
  await client.query(
    `insert into public.profiles (owner_id, slug, full_name) values ($1, $2, 'Owner B')`,
    [ownerB, slugB],
  );
  const emailA = randomUUID();
  await client.query(
    `insert into public.fields (id, owner_id, kind, label, value, is_public, sort)
     values ($1, $2, 'email', 'Personal', 'owner-a@example.invalid', true, 1)`,
    [emailA, ownerA],
  );
  await client.query(
    `insert into public.fields (owner_id, kind, label, value, is_public, sort)
     values ($1, 'phone', 'Mobile', '+10000000000', true, 2)`,
    [ownerA],
  );
  await client.query(
    `insert into public.fields (owner_id, kind, label, value, is_public, sort)
     values ($1, 'social_link', 'Social profile', 'https://social.example/owner-a', true, 3)`,
    [ownerA],
  );
  await client.query(
    `insert into public.fields (owner_id, kind, label, value, is_public, sort)
     values ($1, 'social_link', 'Private profile', 'https://example.invalid/private', false, 4)`,
    [ownerA],
  );
  // A private note + an encrypted sensitive value (must never reach a visitor).
  await client.query(
    `insert into public.fields (owner_id, kind, label, value, is_public, sort)
     values ($1, 'note', 'Private', 'seed-marker-note', false, 5)`,
    [ownerA],
  );
  await client.query(
    `insert into public.fields (owner_id, kind, label, value_encrypted, is_sensitive, is_public, sort)
     values ($1, 'account_record', 'Bank', 'v1.k1.nonce.ciphertext.tag', true, false, 6)`,
    [ownerA],
  );

  // --- A-T1: two-user RLS isolation ---------------------------------------
  await test('A-T1 two-user RLS isolation', async () => {
    await asRole('authenticated', ownerB);
    const visible = await scalar(`select count(*) from public.profiles`);
    assert(Number(visible) === 1, `user B sees ${visible} profiles (expected only their own)`);
    const aProfiles = await scalar(
      `select count(*) from public.profiles where owner_id = $1`,
      [ownerA],
    );
    assert(Number(aProfiles) === 0, 'user B can read user A profiles');

    const fieldsVisible = await scalar(`select count(*) from public.fields`);
    assert(Number(fieldsVisible) === 0, `user B sees ${fieldsVisible} of A's fields`);

    await expectError(
      () =>
        client.query(
          `insert into public.fields (owner_id, kind, value) values ($1, 'email', 'x@y.z')`,
          [ownerA],
        ),
      'row-level security|violates',
    );
  });

  await test('A-T1b user B cannot update or delete A rows', async () => {
    await asRole('authenticated', ownerB);
    const updated = await client.query(
      `update public.profiles set full_name = 'hacked' where owner_id = $1 returning id`,
      [ownerA],
    );
    assert(updated.rowCount === 0, 'user B updated user A profile');
    const deleted = await client.query(`delete from public.fields where owner_id = $1`, [ownerA]);
    assert(deleted.rowCount === 0, 'user B deleted user A fields');
  });

  // --- A-T2: anon cannot read tables or execute functions ------------------
  await test('A-T2 anon cannot select or execute', async () => {
    await asRole('anon', null);
    await expectError(() => client.query(`select * from public.profiles`), 'permission denied');
    await expectError(
      () => client.query(`select public.consume_access_code('${slugA}', 'x', 15, 'ip', 'ua')`),
      'permission denied',
    );
    await expectError(
      () => client.query(`select public.get_granted_profile('${randomUUID()}', '${slugA}')`),
      'permission denied',
    );

    await asRole('authenticated', ownerA);
    await expectError(
      () => client.query(`select public.consume_access_code('${slugA}', 'x', 15, 'ip', 'ua')`),
      'permission denied',
    );
  });

  await test('A-T2b public_profile does not exist', async () => {
    await asPostgres();
    const n = await scalar(
      `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'public_profile'`,
    );
    assert(Number(n) === 0, 'public_profile still exists');
  });

  // --- A-T3: slug immutability --------------------------------------------
  await test('A-T3 slug change raises', async () => {
    await asPostgres();
    await expectError(
      () => client.query(`update public.profiles set slug = 'ccccccc2ccccccc2' where owner_id = $1`, [ownerA]),
      'slug is immutable',
    );
    await asRole('authenticated', ownerA);
    await expectError(
      () => client.query(`update public.profiles set slug = 'ddddddd2ddddddd2' where owner_id = $1`, [ownerA]),
      'slug is immutable',
    );
  });

  await test('A-T3b non-slug updates still work', async () => {
    await asRole('authenticated', ownerA);
    const r = await client.query(
      `update public.profiles set full_name = 'Owner A Renamed', show_photo = true where owner_id = $1 returning slug`,
      [ownerA],
    );
    assert(r.rowCount === 1, 'owner could not update their profile');
    assert(r.rows[0].slug === slugA, 'slug changed during a normal update');
  });

  // --- A-T4: rate windows + lockout ---------------------------------------
  await test('A-T4 IP window then slug lockout revokes codes', async () => {
    await asPostgres();
    // Fresh active grant.
    const gid = randomUUID();
    await client.query(
      `insert into public.access_grants (id, owner_id, code_hash, scope, expires_at)
       values ($1, $2, 'hash-active-1', 'contact', now() + interval '10 minutes')`,
      [gid, ownerA],
    );
    // 5 invalid attempts from one IP within 10 minutes.
    for (let i = 0; i < 5; i++) {
      await client.query(
        `insert into public.access_log (owner_id, slug, outcome, ip_hash)
         values ($1, $2, 'invalid', 'ip-1')`,
        [ownerA, slugA],
      );
    }
    const v1 = await scalar(`select public.consume_access_code($1, 'nope', 15, 'ip-1', 'ua')`, [slugA]);
    assert(v1.reason === 'rate_limited', `expected rate_limited, got ${v1.reason}`);

    // 10 invalid on the slug (any IP) -> lockout + outstanding codes revoked.
    for (let i = 0; i < 5; i++) {
      await client.query(
        `insert into public.access_log (owner_id, slug, outcome, ip_hash)
         values ($1, $2, 'invalid', 'ip-2')`,
        [ownerA, slugA],
      );
    }
    const v2 = await scalar(`select public.consume_access_code($1, 'nope', 15, 'ip-3', 'ua')`, [slugA]);
    assert(v2.reason === 'locked', `expected locked, got ${v2.reason}`);

    const revoked = await scalar(
      `select count(*) from public.access_grants where id = $1 and revoked_at is not null`,
      [gid],
    );
    assert(Number(revoked) === 1, 'outstanding code was not revoked on slug lockout');

    // Clear log + lockout so later tests are unaffected.
    await clearAppendOnly('access_log');
    await client.query(`delete from public.lockouts where key_hash = $1`, [slugA]);
  });

  // --- A-T5: exactly-once consume -----------------------------------------
  await test('A-T5 consume is exactly-once', async () => {
    await asPostgres();
    await client.query(
      `insert into public.access_grants (owner_id, code_hash, scope, expires_at)
       values ($1, 'hash-once', 'full', now() + interval '10 minutes')`,
      [ownerA],
    );
    const first = await scalar(`select public.consume_access_code($1, 'hash-once', 15, 'ip-x', 'ua')`, [slugA]);
    assert(first.ok === true, `first consume failed: ${JSON.stringify(first)}`);

    // Audit integrity: the log row references the grant, so the grant can no
    // longer be deleted — it can only be revoked. (The FK action is deliberately
    // NO ACTION: a SET NULL cascade would be an update on an append-only table.)
    await expectError(
      () => client.query(`delete from public.access_grants where code_hash = 'hash-once'`),
      'foreign key constraint',
    );

    const second = await scalar(`select public.consume_access_code($1, 'hash-once', 15, 'ip-x', 'ua')`, [slugA]);
    assert(second.ok === false && second.reason === 'used', `second consume: ${JSON.stringify(second)}`);
    assert(second.grant_id === null, 'a failed consume must never hand out a grant id');

    // Reset so the following cases start from an empty log.
    await clearAppendOnly('access_log');
    await client.query(`delete from public.access_grants where code_hash = 'hash-once'`);
  });

  // --- A-T6: scope projection ---------------------------------------------
  await test('A-T6 contact scope never returns photo/dob/address', async () => {
    await asPostgres();
    await client.query(
      `insert into public.access_grants (owner_id, code_hash, scope, expires_at)
       values ($1, 'hash-contact', 'contact', now() + interval '10 minutes')`,
      [ownerA],
    );
    const v = await scalar(`select public.consume_access_code($1, 'hash-contact', 15, 'ip-x', 'ua')`, [slugA]);
    const prof = await scalar(`select public.get_granted_profile($1, $2)`, [v.grant_id, slugA]);
    const expectedName = await scalar(`select full_name from public.profiles where owner_id = $1`, [
      ownerA,
    ]);
    assert(prof.full_name === expectedName, `name missing (got ${JSON.stringify(prof.full_name)})`);
    assert(prof.photo_path === null, 'contact grant leaked photo');
    assert(prof.dob === null, 'contact grant leaked dob');
    assert(prof.address === null, 'contact grant leaked address');
    assert(Array.isArray(prof.emails) && prof.emails.length === 1, 'public email missing');
    assert(Array.isArray(prof.phones) && prof.phones.length === 1, 'public phone missing');
    assert(Array.isArray(prof.social_links) && prof.social_links.length === 1, 'public social link missing');
    assert(prof.social_links[0].value === 'https://social.example/owner-a', 'wrong public social link returned');
  });

  await test('A-T6b full scope still excludes sensitive/notes/documents', async () => {
    const v = await scalar(
      `select public.consume_access_code($1, 'hash-contact', 15, 'ip-x', 'ua')`,
      [slugA],
    );
    // The grant is now used; mint a fresh full grant.
    await asPostgres();
    await client.query(
      `insert into public.access_grants (owner_id, code_hash, scope, expires_at)
       values ($1, 'hash-full', 'full', now() + interval '10 minutes')`,
      [ownerA],
    );
    const vf = await scalar(`select public.consume_access_code($1, 'hash-full', 15, 'ip-x', 'ua')`, [slugA]);
    const prof = JSON.stringify(
      await scalar(`select public.get_granted_profile($1, $2)`, [vf.grant_id, slugA]),
    );
    assert(!prof.includes('seed-marker-note'), 'note leaked into granted profile');
    assert(!prof.includes('v1.k1.nonce.ciphertext.tag'), 'encrypted value leaked');
    assert(!/aadhaar|pan|account/i.test(prof) || !prof.includes('Bank'), 'sensitive record leaked');
    assert(!prof.includes('example.invalid/private'), 'private social link leaked');
    void v;
  });

  await test('A-T6c expired/revoked grant returns null', async () => {
    await asPostgres();
    const gid = randomUUID();
    await client.query(
      `insert into public.access_grants (id, owner_id, code_hash, scope, expires_at, used_at, revoked_at, session_expires_at)
       values ($1, $2, 'hash-revoked', 'full', now() + interval '10 minutes', now(), now(), now() + interval '15 minutes')`,
      [gid, ownerA],
    );
    const prof = await scalar(`select public.get_granted_profile($1, $2)`, [gid, slugA]);
    assert(prof === null, 'revoked grant still returned a profile');
  });

  // --- A-T7: append-only + system category guard --------------------------
  await test('A-T7 logs are append-only', async () => {
    await asPostgres();
    await client.query(
      `insert into public.access_log (owner_id, slug, outcome) values ($1, $2, 'invalid')`,
      [ownerA, slugA],
    );
    await expectError(
      () => client.query(`update public.access_log set outcome = 'granted'`),
      'append-only',
    );
    await expectError(() => client.query(`delete from public.access_log`), 'append-only');
    await client.query(
      `insert into public.audit_log (owner_id, actor, action) values ($1, 'system', 'test')`,
      [ownerA],
    );
    await expectError(() => client.query(`delete from public.audit_log`), 'append-only');
  });

  await test('A-T7b system category cannot be deleted', async () => {
    // Deletion is blocked for the application role...
    await asRole('authenticated', ownerA);
    await expectError(
      () => client.query(`delete from public.categories where owner_id = $1 and is_system`, [ownerA]),
      'system categories cannot be deleted',
    );
    // ...but a custom category can be deleted.
    const cid = randomUUID();
    await asPostgres();
    await client.query(
      `insert into public.categories (id, owner_id, name, is_system) values ($1, $2, 'Custom', false)`,
      [cid, ownerA],
    );
    await asRole('authenticated', ownerA);
    const d = await client.query(`delete from public.categories where id = $1`, [cid]);
    assert(d.rowCount === 1, 'custom category could not be deleted');
  });

  // --- A-T8: seed idempotency ---------------------------------------------
  await test('A-T8 seed_categories is idempotent', async () => {
    await asPostgres();
    // handle_new_owner() already seeded on user creation; seeding again must not
    // duplicate rows.
    await client.query(`select public.seed_categories($1)`, [ownerA]);
    await client.query(`select public.seed_categories($1)`, [ownerA]);
    const n = await scalar(`select count(*) from public.categories where owner_id = $1 and is_system`, [ownerA]);
    assert(Number(n) === 14, `expected 14 system categories, got ${n}`);
  });

  // --- A-T9: encrypted column is opaque -----------------------------------
  await test('A-T9 sensitive value is not stored in plaintext', async () => {
    await asPostgres();
    const rows = await client.query(
      `select value, value_encrypted from public.fields where owner_id = $1 and is_sensitive`,
      [ownerA],
    );
    for (const r of rows.rows) {
      assert(r.value === null, 'sensitive row kept a plaintext value');
      assert(typeof r.value_encrypted === 'string' && r.value_encrypted.startsWith('v1.'), 'missing envelope');
    }
  });

  // --- constraint sanity: only shareable, non-sensitive kinds may be public -
  await test('A-T10 public social links are allowed but other public kinds are rejected', async () => {
    await asPostgres();
    const count = await scalar(
      `select count(*) from public.fields where owner_id = $1 and kind = 'social_link' and is_public`,
      [ownerA],
    );
    assert(Number(count) === 1, 'public social link could not be saved');
    await expectError(
      () =>
        client.query(
          `insert into public.fields (owner_id, kind, label, value, is_public)
           values ($1, 'address', 'Home', '1 Road', true)`,
          [ownerA],
        ),
      'fields_public_kind_only',
    );
    await expectError(
      () =>
        client.query(
          `insert into public.fields (owner_id, kind, label, value, is_public, is_sensitive)
           values ($1, 'social_link', 'Sensitive link', 'https://example.invalid', true, true)`,
          [ownerA],
        ),
      'fields_public_kind_only',
    );
  });
} finally {
  await client.query('rollback').catch(() => {});
  await client.end();
}

// --- report ------------------------------------------------------------------
let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ok   ${r.name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${r.name}\n       ${r.detail}`);
  }
}
console.log(
  `\n[db-test] ${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ''}`,
);
process.exit(failed ? 1 : 0);
