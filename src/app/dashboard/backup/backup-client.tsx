'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Shield, Database, FileArchive, AlertCircle } from 'lucide-react';
import { cn } from 'cn';

function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
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

  async function createEncryptedBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">Backup &amp; Export</h1>
        <p className="mt-1 text-sm text-label">Download your vault and personal records.</p>
      </header>

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-hairline bg-white p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Database className="h-5 w-5 text-ink" />
          </div>
          <div>
            <h2 className="font-bold text-ink">Database Export</h2>
            <p className="mt-1 text-sm text-label">
              Download profile data, personal fields, and document metadata in JSON or CSV format.
            </p>
          </div>
          <div className="space-y-2">
            <DownloadLink href="/api/backup?format=json">Export as JSON</DownloadLink>
            <DownloadLink href="/api/backup?format=csv">Export as CSV</DownloadLink>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-hairline bg-white p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FileArchive className="h-5 w-5 text-ink" />
          </div>
          <div>
            <h2 className="font-bold text-ink">File Archive</h2>
            <p className="mt-1 text-sm text-label">Download a ZIP archive containing every document in your vault.</p>
          </div>
          <DownloadLink href="/api/backup?format=zip">Download ZIP</DownloadLink>
          <p className="text-xs text-label">This archive is not encrypted. Store it in a secure location.</p>
        </section>

        <section className="space-y-4 rounded-xl border border-hairline bg-ink p-6 text-white sm:col-span-2">
          <div className="flex items-start gap-4">
            <Shield className="mt-1 h-6 w-6 shrink-0" />
            <div className="w-full space-y-3">
              <h2 className="font-bold">Encrypted Full Backup</h2>
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
                <Button type="submit" disabled={pending || passphrase.length < 12} className="bg-white text-ink hover:bg-white/90">
                  {pending ? 'Creating…' : 'Create Full Backup'}
                </Button>
              </form>
            </div>
          </div>
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
