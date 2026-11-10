import { requireOwner } from '@/lib/auth/session';
import { getProfile } from '@/lib/card/load';
import { UserMenu } from './user-menu';

function firstName(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
}

/**
 * Resolves the owner itself rather than taking one as a prop, so the dashboard
 * layout never has to await the session before it can render its shell. The
 * lookup is deduplicated per request by React `cache()` in `getOwnerOrNull`, so
 * this shares a single Supabase call with the rest of the tree.
 */
export async function DashboardUserMenu({ compact = false }: { compact?: boolean }) {
  const owner = await requireOwner();
  const profile = await getProfile(owner.id);
  const name = firstName(
    owner.user_metadata?.full_name,
    owner.user_metadata?.name,
    profile?.full_name,
  ) ?? owner.email?.split('@')[0] ?? 'Owner';

  return <UserMenu name={name} email={owner.email ?? null} compact={compact} />;
}
