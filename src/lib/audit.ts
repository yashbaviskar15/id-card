import 'server-only';
import { createServiceClient } from '@/lib/db/service';
import { log, redact } from '@/lib/log';
import type { AuditActor } from '@/lib/types';

/**
 * Append-only audit trail. `detail` carries identifiers and outcome enums only —
 * never a sensitive value, code, password or token (see redact()).
 */
export interface AuditEntry {
  ownerId: string;
  actor: AuditActor;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  detail?: Record<string, unknown> | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('audit_log').insert({
      owner_id: entry.ownerId,
      actor: entry.actor,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      detail: entry.detail ? redact(entry.detail) : null,
      ip_hash: entry.ipHash ?? null,
      user_agent: entry.userAgent ?? null,
    });
    if (error) log.warn('audit.write failed', { action: entry.action, code: error.code });
  } catch {
    // Auditing must never break the request it is recording.
    log.warn('audit.write threw', { action: entry.action });
  }
}
