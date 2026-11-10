import type { User } from '@supabase/supabase-js';
import { getProfile } from '@/lib/card/load';
import { UserMenu } from './user-menu';

function firstName(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
}

export async function DashboardUserMenu({ owner }: { owner: User }) {
  const profile = await getProfile(owner.id);
  const name = firstName(
    owner.user_metadata?.full_name,
    owner.user_metadata?.name,
    profile?.full_name,
  ) ?? owner.email?.split('@')[0] ?? 'Owner';

  return <UserMenu name={name} email={owner.email ?? null} />;
}
