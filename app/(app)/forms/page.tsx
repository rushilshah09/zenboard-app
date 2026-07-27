// The global Forms hub — every form in one place, whichever client or project it
// lives under. The per-client and per-project Forms sections remain the way to
// reach a specific one; this is the manage-them-all view. RLS-scoped.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { loadAllForms } from '@/lib/forms';
import { FormsHub } from '@/components/forms/forms-hub';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const [items, { data: projects }, { data: clients }] = await Promise.all([
    loadAllForms(),
    supabase.from('projects').select('id, name').eq('space_id', sid).order('name'),
    supabase.from('clients').select('id, name').eq('space_id', sid).order('name'),
  ]);
  return (
    <FormsHub
      items={items}
      projects={(projects as { id: string; name: string }[]) ?? []}
      clients={(clients as { id: string; name: string }[]) ?? []}
    />
  );
}
