/** State shared between the vault server actions and the vault console. */
export interface VaultState {
  ok: boolean;
  error?: string;
  message?: string;
}

export const initialVaultState: VaultState = { ok: false };
