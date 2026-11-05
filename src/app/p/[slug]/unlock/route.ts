import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { createVisitorSession, visitorSessionCookieName } from "@/lib/visitor-session";

const codeSchema = z.string().regex(/^\d{8}$/);
const genericFailure = "That access code is invalid or no longer available.";

function codeHash(code: string): Buffer {
  const secret = process.env.ACCESS_CODE_HMAC_SECRET;
  if (!secret) throw new Error("ACCESS_CODE_HMAC_SECRET is required for access codes");
  return createHmac("sha256", secret).update(code).digest();
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.formData();
  const parsedCode = codeSchema.safeParse(body.get("code"));
  if (!/^[A-Za-z0-9_-]{12,}$/.test(slug) || !parsedCode.success) {
    return new Response(genericFailure, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await getAdminClient().rpc("consume_access_grant", {
    requested_slug: slug,
    requested_code_hash: codeHash(parsedCode.data)
  }).maybeSingle();

  if (error || !data) {
    return new Response(genericFailure, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const grant = z.object({
    grant_id: z.string().uuid(),
    session_expires_at: z.string().datetime()
  }).safeParse(data);
  if (!grant.success) {
    return new Response(genericFailure, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.redirect(new URL(`/p/${slug}`, request.url), 303);
  response.cookies.set({
    name: visitorSessionCookieName,
    value: createVisitorSession(grant.data.grant_id, slug, grant.data.session_expires_at),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(grant.data.session_expires_at),
    path: `/p/${slug}`
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}