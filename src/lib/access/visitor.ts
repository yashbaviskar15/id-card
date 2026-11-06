import 'server-only';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/db/service';
import {
  cookieOptions,
  ownerCookieSecret,
  signCookie,
  verifyCookie,
  visitorCookieName,
  type CookiePayload,
} from '@/lib/crypto/cookies';
import { signedServiceUrl } from '@/lib/storage';
import { log } from '@/lib/log';
import type { GrantedProfile } from '@/lib/types';

/** Hard ceiling on a visitor session, independent of the environment value. */
const MAX_VISITOR_SESSION_SECONDS = 60 * 60;

export interface VisitorSession {
  grantId: string;
  slug: string;
}

/**
 * The visitor cookie is path-scoped to `/p/<slug>` so it is only ever sent to
 * that one profile's routes (the page and its vCard download) and never to any
 * other slug, dashboard route or API.
 */
export function visitorCookiePath(slug: string): string {
  return `/p/${slug}`;
}

export async function setVisitorSession(session: VisitorSession, maxAgeSeconds: number): Promise<void> {
  const ttl = Math.max(1, Math.min(MAX_VISITOR_SESSION_SECONDS, Math.floor(maxAgeSeconds)));
  const token = signCookie({ g: session.grantId, s: session.slug }, ttl * 1000, ownerCookieSecret());
  const store = await cookies();
  store.set(visitorCookieName(session.slug), token, cookieOptions(ttl, visitorCookiePath(session.slug)));
}

export async function clearVisitorSession(slug: string): Promise<void> {
  const store = await cookies();
  store.set(visitorCookieName(slug), '', cookieOptions(0, visitorCookiePath(slug)));
}

/**
 * Verifies the signed cookie. The payload carries two things only — the grant
 * id and the slug it was minted for — and the slug must match the requested
 * one, so a session can never be replayed against a different profile.
 */
export async function readVisitorSession(slug: string): Promise<VisitorSession | null> {
  const store = await cookies();
  const token = store.get(visitorCookieName(slug))?.value;
  const result = verifyCookie<CookiePayload>(token, ownerCookieSecret());
  if (!result.ok || !result.payload) return null;

  const grantId = result.payload.g;
  const boundSlug = result.payload.s;
  if (typeof grantId !== 'string' || typeof boundSlug !== 'string') return null;
  if (boundSlug !== slug) return null;

  return { grantId, slug };
}

/**
 * Re-validates the session on every request and returns the only projection a
 * visitor can ever receive. The database function returns nothing once the
 * grant is revoked, the session has expired, or the profile is switched off —
 * so revoking a grant ends a live session immediately, and expiry needs no
 * client cooperation.
 */
export async function loadGrantedProfile(
  slug: string,
): Promise<{ grantId: string; profile: GrantedProfile } | null> {
  const session = await readVisitorSession(slug);
  if (!session) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_granted_profile', {
    p_grant_id: session.grantId,
    p_slug: slug,
  });
  if (error) {
    log.warn('access.profile read failed', { code: error.code });
    return null;
  }
  if (!data) return null;
  return { grantId: session.grantId, profile: data as GrantedProfile };
}

/**
 * The photo lives in the private bucket, so a visitor can only ever see it
 * through a short-lived signed URL minted server-side after the grant check.
 */
export async function signedVisitorPhotoUrl(path: string | null): Promise<string | null> {
  return signedServiceUrl(path);
}

export interface GrantedDocumentTarget {
  storagePath: string;
  name: string;
  mime: string;
}

/**
 * Resolves one shared document for a live visitor session. The database only
 * returns a storage path when the grant opted into documents, the document is
 * still shared, and the grant is still valid — so an unshared, revoked or
 * expired request simply yields null.
 */
export async function loadGrantedDocument(
  slug: string,
  documentId: string,
): Promise<GrantedDocumentTarget | null> {
  const session = await readVisitorSession(slug);
  if (!session) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_granted_document', {
    p_grant_id: session.grantId,
    p_slug: slug,
    p_document_id: documentId,
  });
  if (error) {
    log.warn('access.document read failed', { code: error.code });
    return null;
  }
  if (!data) return null;

  const row = data as { storage_path: string; name: string; mime: string };
  if (!row.storage_path) return null;
  return { storagePath: row.storage_path, name: row.name, mime: row.mime };
}

/** Appends one `session_view` row to the access log. Never blocks rendering. */
export async function recordVisitorView(input: {
  slug: string;
  grantId: string;
  ipHash: string | null;
  userAgent: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('owner_id')
    .eq('slug', input.slug)
    .maybeSingle<{ owner_id: string }>();
  if (!data) return;

  const { error } = await supabase.rpc('record_access_event', {
    p_owner_id: data.owner_id,
    p_grant_id: input.grantId,
    p_slug: input.slug,
    p_outcome: 'session_view',
    p_ip_hash: input.ipHash,
    p_user_agent: input.userAgent,
  });
  if (error) log.warn('access.log view failed', { code: error.code });
}
