import { NextResponse, type NextRequest } from 'next/server';
import { createUserClient } from '@/lib/db/user';
import { clearReauthenticated } from '@/lib/auth/reauth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  await clearReauthenticated();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
