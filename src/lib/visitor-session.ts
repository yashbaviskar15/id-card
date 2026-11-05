import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "visitor_session";

function secret(): string {
  const value = process.env.ACCESS_CODE_HMAC_SECRET;
  if (!value) throw new Error("ACCESS_CODE_HMAC_SECRET is required for visitor sessions");
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createVisitorSession(grantId: string, slug: string, expiresAt: string): string {
  const payload = Buffer.from(JSON.stringify({ grantId, slug, expiresAt })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readVisitorSession(value: string | undefined): { grantId: string; slug: string; expiresAt: string } | null {
  if (!value) return null;
  const [payload, providedSignature] = value.split(".");
  if (!payload || !providedSignature) return null;
  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      grantId?: unknown;
      slug?: unknown;
      expiresAt?: unknown;
    };
    if (typeof parsed.grantId !== "string" || typeof parsed.slug !== "string" || typeof parsed.expiresAt !== "string") return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) return null;
    return { grantId: parsed.grantId, slug: parsed.slug, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export { cookieName as visitorSessionCookieName };