'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Shield, Database, FileArchive, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from 'cn';
import { useOffline } from '@/components/offline/offline-provider';
import { OnlineRequiredNotice } from '@/components/offline/online-notice';
import type { BackupSummary, RestoreSummary } from '@/lib/export/restore';

type RestorePhase = 'idle' | 'checking' | 'ready' | 'restoring' | 'done';

interface RestorePayload {
  ok: boolean;
  dry_run?: boolean;
  summary?: BackupSummary;
  restored?: RestoreSummary;
  error?: string;
}

function DownloadLink({ href, children, disabled }: { href: string; children: React.ReactNode; disabled?: boolean }) {
  if (disabled) {
    return (
      <span className={cn(buttonVariants({ variant: 'outline' }), 'w-full gap-2 cursor-not-allowed opacity-50')} aria-disabled="true">
        <Download className="h-4 w-4" />
        {children}
      </span>
    );
  }
  return (
    <a href={href} className={cn(buttonVariants({ variant: 'outline' }), 'w-full gap-2')}>
      <Download className="h-4 w-4" />
      {children}
    </a>
  );
}

export function BackupClient() {
  const [passphrase, setPassphrase] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online } = useOffline();

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restorePhase, setRestorePhase] = useState<RestorePhase>('idle');
  const [drySummary, setDrySummary] = useState<BackupSummary | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  function resetRestore() {
    setRestorePhase('idle');
    setDrySummary(null);
    setRestoreResult(null);
    setRestoreError(null);
  }

  async function postRestore(dryRun: boolean): Promise<RestorePayload> {
    if (!restoreFile) throw new Error('Choose a .idbackup file.');
    const data = new FormData();
    data.set('file', restoreFile);
    data.set('passphrase', restorePassphrase);
    data.set('dryRun', dryRun ? 'true' : 'false');
    const response = await fetch('/api/backup/restore', { method: 'POST', body: data });
    const payload = (await response.json().catch(() => null)) as RestorePayload | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'The backup could not be processed. Try again.');
    }
    return payload;
  }

  async function checkBundle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) return;
    setRestorePhase('checking');
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const payload = await postRestore(true);
      if (!payload.summary) throw new Error('The backup could not be read.');
      setDrySummary(payload.summary);
      setRestorePhase('ready');
    } catch (cause) {
      setRestorePhase('idle');
      setDrySummary(null);
      setRestoreError(cause instanceof Error ? cause.message : 'The backup could not be checked.');
    }
  }

  async function confirmRestore() {
    if (!online || !restoreFile) return;
    const confirmed = window.confirm(
      'Restore this backup now?\n\nYour profile details, information fields and documents will be updated from the bundle. Your permanent profile link (slug) is never changed. Continue?',
    );
    if (!confirmed) return;
    setRestorePhase('restoring');
    setRestoreError(null);
    try {
      const payload = await postRestore(false);
      if (!payload.restored) throw new Error('The backup could not be restored.');
      setRestoreResult(payload.restored);
      setRestorePhase('done');
    } catch (cause) {
      setRestorePhase('ready');
      setRestoreError(cause instanceof Error ? cause.message : 'The backup could not be restored.');
    }
  }

  async function createEncryptedBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/backup/encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Backup could not be created. Try again.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'identity-full-backup.idbackup';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPassphrase('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backup could not be created. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <h1 className="page-title">Backup &amp; export</h1>
        <p className="mt-1 text-sm text-label">Download your vault and personal records.</p>
      </header>

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <OnlineRequiredNotice>
        Backups and exports are generated on the server. Reconnect to download your data.
      </OnlineRequiredNotice>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="surface shadow-card space-y-4 p-5 sm:p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Database className="h-4.5 w-4.5 text-ink" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Database export</h2>
            <p className="mt-1 text-sm text-label">
              Download profile data, personal fields, and document metadata in JSON or CSV format.
            </p>
          </div>
          <div className="space-y-2">
            <DownloadLink href="/api/backup?format=json" disabled={!online}>Export as JSON</DownloadLink>
            <DownloadLink href="/api/backup?format=csv" disabled={!online}>Export as CSV</DownloadLink>
          </div>
        </section>

        <section className="surface shadow-card space-y-4 p-5 sm:p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <FileArchive className="h-4.5 w-4.5 text-ink" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">File archive</h2>
            <p className="mt-1 text-sm text-label">Download a ZIP archive containing every document in your vault.</p>
          </div>
          <DownloadLink href="/api/backup?format=zip" disabled={!online}>Download ZIP</DownloadLink>
          <p className="text-xs text-label">This archive is not encrypted. Store it in a secure location.</p>
        </section>

        <section className="space-y-4 rounded-xl border border-ink bg-ink p-5 text-white sm:col-span-2 sm:p-6">
          <div className="flex items-start gap-4">
            <Shield className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="w-full space-y-3">
              <h2 className="text-sm font-semibold">Encrypted full backup</h2>
              <p className="text-sm text-white/80">
                Create one AES-256-GCM encrypted file with your personal data and documents. The passphrase cannot be recovered.
              </p>
              <form onSubmit={createEncryptedBackup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="backup-passphrase" className="text-white">Backup passphrase</Label>
                  <Input
                    id="backup-passphrase"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={1024}
                    required
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    className="bg-white text-ink"
                  />
                  <p className="text-xs text-white/70">Use at least 12 characters and save it separately.</p>
                </div>
                <Button type="submit" disabled={pending || passphrase.length < 12 || !online} className="bg-white text-ink hover:bg-white/90">
                  {pending ? 'Creating…' : 'Create Full Backup'}
                </Button>
              </form>
            </div>
          </div>
        </section>

        <section className="surface shadow-card space-y-4 p-5 sm:col-span-2 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Upload className="h-4.5 w-4.5 text-ink" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-sm font-semibold text-ink">Import / restore</h2>
              <p className="text-sm text-label">
                Restore a <span className="font-medium text-ink">.idbackup</span> file created by the
                export above. The file is checked first and nothing is written until you confirm.
              </p>
            </div>
          </div>

          <Alert className="border-hairline bg-muted/30">
            <AlertCircle className="h-4 w-4" />
            <div>
              <h3 className="font-medium">What a restore does — and does not do</h3>
              <AlertDescription className="text-sm">
                Only what the bundle contains is restored: the profile’s details, the information
                fields, and document metadata plus any document files it carries. Your permanent
                profile link (slug) is never changed. Items you added after the backup are not
                deleted. Backups do not include your master password or encryption keys.
              </AlertDescription>
            </div>
          </Alert>

          {restoreError ? (
            <Alert variant="destructive">
              <AlertDescription>{restoreError}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={checkBundle} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="restore-file">Backup file (.idbackup)</Label>
                <Input
                  id="restore-file"
                  type="file"
                  accept=".idbackup"
                  disabled={restorePhase === 'checking' || restorePhase === 'restoring'}
                  onChange={(event) => {
                    setRestoreFile(event.target.files?.[0] ?? null);
                    resetRestore();
                  }}
                  className="border-hairline file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-ink"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restore-passphrase">Backup passphrase</Label>
                <Input
                  id="restore-passphrase"
                  type="password"
                  autoComplete="current-password"
                  minLength={12}
                  maxLength={1024}
                  value={restorePassphrase}
                  disabled={restorePhase === 'checking' || restorePhase === 'restoring'}
                  onChange={(event) => setRestorePassphrase(event.target.value)}
                  className="border-hairline"
                />
                <p className="text-xs text-label">The passphrase this backup was created with.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                variant="outline"
                disabled={
                  restorePhase === 'checking' ||
                  restorePhase === 'restoring' ||
                  !restoreFile ||
                  restorePassphrase.length < 12 ||
                  !online
                }
              >
                {restorePhase === 'checking' ? 'Checking…' : 'Check backup'}
              </Button>
              {restorePhase !== 'idle' ? (
                <Button type="button" variant="ghost" onClick={resetRestore} disabled={restorePhase === 'restoring'}>
                  Start over
                </Button>
              ) : null}
            </div>
          </form>

          {drySummary && restorePhase !== 'done' ? (
            <div className="space-y-3 rounded-lg border border-hairline bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-ink" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-ink">Backup checked — ready to restore</h3>
              </div>
              <p className="text-sm text-label">
                This bundle was created{' '}
                <span className="text-ink">
                  {drySummary.exported_at ? new Date(drySummary.exported_at).toLocaleString() : 'at an unknown time'}
                </span>
                .
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-label">Profile</dt>
                  <dd className="font-medium text-ink">{drySummary.has_profile ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Information fields</dt>
                  <dd className="tnum font-medium text-ink">{drySummary.fields}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Documents</dt>
                  <dd className="tnum font-medium text-ink">{drySummary.documents}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">With files</dt>
                  <dd className="tnum font-medium text-ink">{drySummary.documents_with_files}</dd>
                </div>
              </dl>
              <p className="text-xs text-label">
                Writing will update your profile details, information fields and document files from
                this bundle. Your slug is never changed.
              </p>
              <Button type="button" onClick={confirmRestore} disabled={restorePhase === 'restoring' || !online}>
                {restorePhase === 'restoring' ? 'Restoring…' : 'Restore this backup'}
              </Button>
            </div>
          ) : null}

          {restoreResult ? (
            <div className="space-y-3 rounded-lg border border-hairline bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-ink" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-ink">Restore complete</h3>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-label">Profile</dt>
                  <dd className="font-medium text-ink capitalize">{restoreResult.profile}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Fields restored</dt>
                  <dd className="tnum font-medium text-ink">{restoreResult.fields_restored}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Fields failed</dt>
                  <dd className="tnum font-medium text-ink">{restoreResult.fields_failed}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Documents restored</dt>
                  <dd className="tnum font-medium text-ink">{restoreResult.documents_restored}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Documents skipped</dt>
                  <dd className="tnum font-medium text-ink">{restoreResult.documents_skipped}</dd>
                </div>
                <div>
                  <dt className="text-xs text-label">Documents rejected</dt>
                  <dd className="tnum font-medium text-ink">{restoreResult.documents_rejected}</dd>
                </div>
              </dl>
              <p className="text-xs text-label">
                Documents are only restored when the bundle carries their file and it passes the
                upload checks; metadata-only entries are skipped. This action was written to your
                audit log.
              </p>
              <Button type="button" variant="outline" onClick={resetRestore}>
                Restore another backup
              </Button>
            </div>
          ) : null}
        </section>

        <Alert className="border-hairline bg-muted/30 sm:col-span-2">
          <AlertCircle className="h-4 w-4" />
          <div>
            <h3 className="font-medium">Important</h3>
            <AlertDescription className="text-sm">
              Backups do not include your master password or encryption keys. Keep any backup passphrase and recovery keys separate and secure.
            </AlertDescription>
          </div>
        </Alert>
      </div>
    </div>
  );
}
