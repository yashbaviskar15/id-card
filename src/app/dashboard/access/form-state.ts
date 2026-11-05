import type { AccessScope } from '@/lib/types';

/** State shared between the access server actions and the give-access console. */
export interface GrantFormState {
  ok: boolean;
  error?: string;
  /** The plaintext code, shown once to the owner. Never stored, never logged. */
  code?: string;
  grantId?: string;
  expiresAt?: string;
  scope?: AccessScope;
}

export const initialGrantState: GrantFormState = { ok: false };
