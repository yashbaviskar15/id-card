/**
 * Frozen shared types. They mirror supabase/migrations/0001_init.sql exactly —
 * change both together, and only before the workstreams fan out.
 */

export type AccessScope = 'contact' | 'full';

export type FieldKind =
  | 'email'
  | 'phone'
  | 'social_link'
  | 'address'
  | 'family_contact'
  | 'emergency_contact'
  | 'important_date'
  | 'note'
  | 'account_record'
  | 'custom';

/** Only these kinds may ever be exposed to a visitor (enforced in the database too). */
export const PUBLIC_FIELD_KINDS = ['email', 'phone', 'social_link'] as const satisfies readonly FieldKind[];

export type GrantStatus = 'active' | 'used' | 'expired' | 'revoked';
export type VisitorTheme = 'ink' | 'ocean' | 'forest';
export type VisitorLayout = 'standard' | 'compact';

export type AccessOutcome =
  | 'granted'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'rate_limited'
  | 'locked'
  | 'session_view'
  | 'session_end';

export type AuditActor = 'owner' | 'visitor' | 'system';

export interface ProfileRow {
  id: string;
  owner_id: string;
  /** Permanent. Generated once at creation; a database trigger rejects any change. */
  slug: string;
  full_name: string;
  dob: string | null;
  address: string | null;
  photo_path: string | null;
  show_dob: boolean;
  show_address: boolean;
  show_photo: boolean;
  visitor_theme: VisitorTheme;
  visitor_layout: VisitorLayout;
  visitor_intro: string;
  /** Owner kill switch: false disables the public profile without touching the slug. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldRow {
  id: string;
  owner_id: string;
  kind: FieldKind;
  label: string | null;
  value: string | null;
  /** AES-256-GCM envelope (v1.<keyId>.<nonce>.<ct>.<tag>) — never sent to a visitor. */
  value_encrypted: string | null;
  is_sensitive: boolean;
  is_public: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  owner_id: string;
  name: string;
  sort: number;
  is_system: boolean;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  owner_id: string;
  category_id: string | null;
  name: string;
  storage_path: string;
  mime: string;
  size: number;
  sha256: string | null;
  /** Owner opt-in: only a shared document can reach a visitor. */
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShareLinkRow {
  id: string;
  owner_id: string;
  document_id: string;
  token_hash: string;
  password_hash: string | null;
  expires_at: string;
  max_downloads: number | null;
  download_count: number;
  revoked_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
}

export interface AccessGrantRow {
  id: string;
  owner_id: string;
  /** HMAC-SHA256(slug + ':' + code). The code itself is never stored. */
  code_hash: string;
  scope: AccessScope;
  /** When true, the visitor session may also open the owner's shared documents. */
  include_documents: boolean;
  /** End of the code's validity window. */
  expires_at: string;
  used_at: string | null;
  session_expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AccessLogRow {
  id: string;
  owner_id: string;
  grant_id: string | null;
  slug: string;
  outcome: AccessOutcome;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  owner_id: string;
  actor: AuditActor;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface OwnerSettingsRow {
  owner_id: string;
  default_scope: AccessScope;
  default_validity_minutes: number;
  visitor_session_minutes: number;
  alert_on_new_device: boolean;
  alert_on_lockout: boolean;
  totp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecoveryCodeRow {
  id: string;
  owner_id: string;
  code_hash: string;
  used_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Visitor-facing projections (produced only by the database function) */
/* ------------------------------------------------------------------ */

export interface GrantContactItem {
  label: string | null;
  /**
   * The `fields.value` column is nullable, so the database projection can
   * return null here. Consumers must guard against null/empty values.
   */
  value: string | null;
}

/** Metadata of one shareable document. Never carries a storage path or URL. */
export interface GrantDocument {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Opaque row revision used to refresh a live visitor document preview. */
  updated_at: string;
}

/** The complete set of data a visitor session can ever receive. */
export interface GrantedProfile {
  full_name: string;
  scope: AccessScope;
  /** Present only for a 'full' grant whose show_photo flag is on. */
  photo_path: string | null;
  /** Present only for a 'full' grant whose show_dob flag is on. */
  dob: string | null;
  /** Present only for a 'full' grant whose show_address flag is on. */
  address: string | null;
  visitor_theme: VisitorTheme;
  visitor_layout: VisitorLayout;
  visitor_intro: string;
  emails: GrantContactItem[];
  phones: GrantContactItem[];
  /** Public, non-sensitive HTTPS links selected by the owner. */
  social_links: GrantContactItem[];
  /** Shared documents the owner opted into for this specific grant. */
  documents: GrantDocument[];
  can_view_documents: boolean;
  session_expires_at: string;
  /** Database clock sampled with the visitor projection for an accurate timer. */
  server_now: string;
}

/* ------------------------------------------------------------------ */
/* Private photo album                                                 */
/* ------------------------------------------------------------------ */

export interface PrivatePhotoRow {
  id: string;
  owner_id: string;
  name: string;
  /** Storage object holding the AES-256-GCM encrypted bytes. */
  storage_path: string;
  mime: string;
  size: number;
  created_at: string;
  updated_at: string;
}

/** Metadata of one album photo a visitor may view. Never carries a storage path. */
export interface GrantedPhoto {
  id: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

/** The complete album projection a password-verified visitor session can receive. */
export interface GrantedPhotoAlbum {
  photos: GrantedPhoto[];
  session_expires_at: string;
  /** Database clock sampled with the projection, for an accurate timer. */
  server_now: string;
}

export interface GrantedPhotoTarget {
  ownerId: string;
  storagePath: string;
  mime: string;
  name: string;
}

export type GrantVerdictReason =
  | 'granted'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'rate_limited'
  | 'locked'
  | 'inactive';

export interface ConsumeCodeVerdict {
  ok: boolean;
  reason: GrantVerdictReason;
  grant_id: string | null;
  scope: AccessScope | null;
  session_expires_at: string | null;
}

export interface GrantStatusView {
  id: string;
  scope: AccessScope;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  session_expires_at: string | null;
  revoked_at: string | null;
  status: GrantStatus;
}

export interface SessionInfo {
  id: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  current: boolean;
}
