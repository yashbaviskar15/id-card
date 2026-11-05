#!/usr/bin/env node
/**
 * generate-secrets.mjs — generates the required cryptographic secrets for the
 * Private Identity Vault.
 */
import { randomBytes } from 'node:crypto';

function gen(bytes) {
  return randomBytes(bytes).toString('base64url');
}

function genKey() {
  return randomBytes(32).toString('base64');
}

console.log('# --- Add these to your Vercel Project Settings > Environment Variables ---');
console.log('');
console.log(`ACCESS_CODE_SECRET="${gen(48)}"`);
console.log(`SESSION_COOKIE_SECRET="${gen(48)}"`);
console.log(`IP_HASH_SECRET="${gen(48)}"`);
console.log('');
console.log('# AES-256-GCM keyring for sensitive fields');
console.log(`FIELD_ENCRYPTION_KEYS='{"k1":"${genKey()}"}'`);
console.log(`FIELD_ENCRYPTION_ACTIVE_KEY="k1"`);
console.log('');
console.log('# --- End of generated secrets ---');
