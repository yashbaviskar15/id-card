import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoManager, type InformationField } from './info-manager';

export const dynamic = 'force-dynamic';

export default async function InfoPage() {
  const owner = await requireOwner('/dashboard/info');
  const supabase = await createUserClient();

  const { data: rows, error } = await supabase
    .from('fields')
    .select('id, kind, label, value, is_sensitive, is_public, sort')
    .eq('owner_id', owner.id)
    .order('sort', { ascending: true });

  return (
    <>
      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            Information could not be loaded. Check the Supabase schema and access policies, then refresh.
          </AlertDescription>
        </Alert>
      ) : null}
      <InfoManager
        initialFields={(rows ?? []).map((field): InformationField => ({
          id: field.id,
          kind: field.kind as InformationField['kind'],
          label: field.label ?? '',
          value: field.value ?? '',
          is_sensitive: field.is_sensitive,
          is_public: field.is_public,
          sort: field.sort,
        }))}
      />
    </>
  );
}
