/** Shared with the auth server actions and their client forms. */
export interface FormState {
  ok: boolean;
  error?: string;
  message?: string;
  /** Set when the next attempt must include a Turnstile token. */
  captchaRequired?: boolean;
  /** Set when the password was accepted but a second factor is still required. */
  mfaRequired?: boolean;
  /** Field-level messages, keyed by form field name. */
  fieldErrors?: Record<string, string[]>;
}

export const initialFormState: FormState = { ok: false };
