import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { Button } from '@/components/ui/button';
import { Plus, Shield, ShieldOff, Eye, EyeOff, Trash2, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FieldRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  family_contact: 'Family Contact',
  emergency_contact: 'Emergency',
  important_date: 'Date',
  note: 'Note',
  account_record: 'Account',
  custom: 'Custom',
};

export default async function InfoPage() {
  const owner = await requireOwner('/dashboard/info');
  const supabase = await createUserClient();

  const { data: fields } = await supabase
    .from('fields')
    .select('*')
    .eq('owner_id', owner.id)
    .order('sort', { ascending: true });

  const groupedFields = fields?.reduce((acc, field) => {
    if (!acc[field.kind]) acc[field.kind] = [];
    acc[field.kind].push(field);
    return acc;
  }, {} as Record<string, typeof fields>);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Information Manager</h1>
          <p className="mt-1 text-sm text-label">
            Manage your personal data and privacy settings.
          </p>
        </div>
        <Button className="h-9 gap-2">
          <Plus className="h-4 w-4" />
          Add field
        </Button>
      </header>

      <div className="space-y-8">
        {Object.entries(KIND_LABELS).map(([kind, label]) => {
          const items = groupedFields?.[kind] || [];
          if (items.length === 0 && !['email', 'phone'].includes(kind)) return null;

          return (
            <section key={kind} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-label">
                  {label}
                </h2>
                {items.length === 0 && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-hairline bg-white overflow-hidden divide-y divide-subtle-line">
                {items.length > 0 ? (
                  items.map((field: FieldRow) => (
                    <div key={field.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                      <div className="cursor-grab text-subtle-line hover:text-label">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-label">{field.label}</span>
                          {field.is_sensitive && (
                            <Badge variant="outline" className="h-4 px-1 text-[10px] gap-0.5 border-ink/20 text-ink">
                              <Shield className="h-2.5 w-2.5" /> Sensitive
                            </Badge>
                          )}
                          {field.is_public && (
                            <Badge variant="outline" className="h-4 px-1 text-[10px] gap-0.5 border-ink/20 text-ink">
                              <Eye className="h-2.5 w-2.5" /> Public
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate font-medium text-ink">
                          {field.is_sensitive ? '••••••••••••' : field.value}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {field.is_sensitive ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </Button>
                        {['email', 'phone'].includes(field.kind) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {field.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-label">
                    No {label.toLowerCase()} added yet.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
