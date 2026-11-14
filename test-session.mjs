import { createHmac } from 'node:crypto';

const SECRET = '012345678901234567890123456789012345';
const slug = 'testslug';
const grantId = '12345678-1234-1234-1234-123456789012';

function b64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function hmacHex(secret, data) {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function signCookie(payload, ttlMs, secret) {
  const now = Date.now();
  const full = { ...payload, iat: now, exp: now + ttlMs };
  const body = b64url(JSON.stringify(full));
  return `${body}.${hmacHex(secret, body)}`;
}

const token = signCookie({ g: grantId, s: slug }, 15 * 60 * 1000, SECRET);
const cookieName = `piv_v_${slug.slice(0, 8)}`;
console.log(`${cookieName}=${token}`);
