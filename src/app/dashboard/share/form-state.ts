/** State shared between the share server actions and the share console. */
export interface CreatedShareLink {
  /** The full shareable URL, present only immediately after creation. */
  url: string;
  shareId: string;
  expiresAt: string;
  documentName: string;
}

export interface ShareState {
  ok: boolean;
  error?: string;
  message?: string;
  /** One entry per link created in this request (bulk creation yields many). */
  links?: CreatedShareLink[];
}

export const initialShareState: ShareState = { ok: false };
