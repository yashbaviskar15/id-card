import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { Button } from '@/components/ui/button';
import { Plus, Search, FileIcon, ExternalLink, Download, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default async function VaultPage() {
  const owner = await requireOwner('/dashboard/vault');
  const supabase = await createUserClient();

  const { data: documents } = await supabase
    .from('documents')
    .select('*, categories(name)')
    .eq('owner_id', owner.id)
    .order('created_at', { ascending: false });

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('owner_id', owner.id)
    .order('sort', { ascending: true });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Vault</h1>
          <p className="mt-1 text-sm text-label">
            Securely store and share your documents.
          </p>
        </div>
        <Button className="h-9 gap-2">
          <Plus className="h-4 w-4" />
          Upload
        </Button>
      </header>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label" />
          <Input 
            placeholder="Search documents..." 
            className="pl-9"
          />
        </div>
        <select className="h-10 rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-ring">
          <option value="">All categories</option>
          {categories?.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-hairline bg-white overflow-hidden">
        {documents && documents.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-subtle-line bg-muted/50 text-label">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Size</th>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle-line">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                        <FileIcon className="h-4 w-4 text-label" />
                      </div>
                      <span className="font-medium text-ink">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-label">
                    {doc.categories?.name || 'Uncategorized'}
                  </td>
                  <td className="px-6 py-4 text-label">
                    {(doc.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-label">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileIcon className="h-6 w-6 text-label" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">No documents</h3>
            <p className="mt-1 text-sm text-label">Upload your first document to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
