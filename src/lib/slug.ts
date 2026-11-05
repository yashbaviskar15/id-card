/**
 * The permanent public slug shape: 16 characters of RFC 4648 lowercase base32
 * (a–z, 2–7) = 80 bits of randomness.
 *
 * This lives in its own module with no `server-only` import so both client
 * validation and server code can share the exact same rule.
 */
export const SLUG_PATTERN = /^[a-z2-7]{16}$/;
