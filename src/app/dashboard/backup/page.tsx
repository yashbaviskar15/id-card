import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import { Button } from '@/components/ui/button';
import { Download, Shield, Database, FileArchive, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

export default async function BackupPage() {
  await requireOwner('/dashboard/backup');
  const reauthenticated = await isReauthenticated();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">Backup & Export</h1>
        <p className="mt-1 text-sm text-label">
          Download your entire vault and all personal records.
        </p>
      </header>

      {!reauthenticated ? (
        <ReauthPanel action="export your data" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-xl border border-hairline bg-white p-6 space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Database className="h-5 w-5 text-ink" />
            </div>
            <div>
              <h2 className="font-bold text-ink">Database Export</h2>
              <p className="mt-1 text-sm text-label">
                Download all your profile data, contacts, and metadata in JSON and CSV formats.
              </p>
            </div>
            <div className="space-y-2">
              <Button className="w-full gap-2" variant="outline">
                <Download className="h-4 w-4" />
                Export as JSON
              </Button>
              <Button className="w-full gap-2" variant="outline">
                <Download className="h-4 w-4" />
                Export as CSV
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-hairline bg-white p-6 space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <FileArchive className="h-5 w-5 text-ink" />
            </div>
            <div>
              <h2 className="font-bold text-ink">File Archive</h2>
              <p className="mt-1 text-sm text-label">
                Download a ZIP archive containing every document in your vault.
              </p>
            </div>
            <Button className="w-full gap-2" variant="outline">
              <Download className="h-4 w-4" />
              Download ZIP (AES-256)
            </Button>
          </section>

          <section className="sm:col-span-2 rounded-xl border border-hairline bg-ink p-6 text-white">
            <div className="flex items-start gap-4">
              <Shield className="h-6 w-6 mt-1" />
              <div className="space-y-3">
                <h2 className="font-bold">Encrypted Backup Bundle</h2>
                <p className="text-sm text-white/80">
                  Create a single, password-protected bundle containing everything. 
                  This uses AES-256-GCM encryption. You will need the passphrase to restore it.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button className="bg-white text-ink hover:bg-white/90">
                    Create Full Backup
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <Alert className="sm:col-span-2 border-hairline bg-muted/30">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription className="text-sm">
              Backups do not include your master password or encryption keys. 
              Store your recovery keys and backup passphrases separately and securely.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
