// The global Forms hub — every form in one place, whichever client or project it
// lives under. The per-client and per-project Forms sections remain the way to
// reach a specific one; this is the manage-them-all view. RLS-scoped.
import { loadAllForms } from '@/lib/forms';
import { FormsHub } from '@/components/forms/forms-hub';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  const { supabase, sid } = await pageScope();
  const [items, { data: projects }, { data: clients }] = await Promise.all([
    loadAllForms(),
    supabase.from('projects').select('id, name').eq('space_id', sid).order('name'),
    supabase.from('clients').select('id, name').eq('space_id', sid).order('name'),
  ]);
  return (
    <>
      <PageStamp />
      <FormsHub
        items={items}
        projects={(projects as { id: string; name: string }[]) ?? []}
        clients={(clients as { id: string; name: string }[]) ?? []}
      />
    </>
  );
}
