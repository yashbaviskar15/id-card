/** State shared between the share server actions and the share console. */
export interface ShareState {
  ok: boolean;
  error?: string;
  message?: string;
  /** The full shareable URL, present only immediately after creation. */
  url?: string;
  shareId?: string;
  expiresAt?: string;
  documentName?: string;
}

export const initialShareState: ShareState = { ok: false };
