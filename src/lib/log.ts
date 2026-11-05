import 'server-only';
import { randomUUID } from 'node:crypto';

/**
 * Logging with mandatory redaction.
 *
 * Rule: access codes, passwords, tokens, cookie values and any decrypted
 * sensitive field must NEVER reach a log line. `redact()` is applied to every
 * value passed to these helpers, and `assertNoSecrets()` is used by tests to
 * prove that marker values never appear in captured output.
 */

const REDACTED = '[redacted]';

const SENSITIVE_KEY_PATTERN =
  /(pass(word)?|secret|token|cookie|code|authorization|api[_-]?key|aadhaar|pan|account[_-]?number|encrypted|hash|salt)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Long opaque strings (tokens, ciphertext, JWTs) are never echoed.
    if (value.length > 120) return `<string:${value.length}>`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, depth + 1);
    }
    return out;
  }
  return '[unloggable]';
}

export interface LogContext {
  ref?: string;
  action?: string;
  actor?: 'owner' | 'visitor' | 'system';
  [key: string]: unknown;
}

function emit(level: 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  const payload = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...(context ? (redact(context) as LogContext) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};

export function newRef(): string {
  return randomUUID().slice(0, 8);
}
