import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createUserClient } from '@/lib/db/user';
import { isOwnerEmail } from '@/lib/env.server';

/**
 * Server-side owner resolution. The OWNER_EMAIL allow-list is re-checked on the
 * server for every request — client state is never trusted.
 */
export async function getOwnerOrNull(): Promise<User | null> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) return null;
  return user;
}

export async function requireOwner(nextPath = '/dashboard'): Promise<User> {
  const user = await getOwnerOrNull();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

/** For route handlers/actions: returns the user or null (no redirect). */
export async function getOwnerIdOrNull(): Promise<string | null> {
  const user = await getOwnerOrNull();
  return user?.id ?? null;
}
