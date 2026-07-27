// Auth gate + app shell for every /(app) route. Unauthenticated users go to
// /login (RLS is the real security boundary). Loads the user's name + spaces and
// renders the sidebar / top bar around the page.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { AppShell } from '@/components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const sid = await activeSpaceId(supabase, user.id);
  const [{ data: spaces }, { data: projects }] = await Promise.all([
    supabase.from('spaces').select('id, name, emoji, color, tag').order('sort_order'),
    supabase.from('projects').select('id, name, color').eq('space_id', sid).eq('status', 'active').order('created_at'),
  ]);

  const name = profile?.full_name?.trim() || user.email?.split('@')[0] || 'there';

  return (
    <AppShell name={name} email={user.email ?? ''} spaces={spaces ?? []} projects={projects ?? []} activeSpaceId={sid}>
      {children}
    </AppShell>
  );
}
