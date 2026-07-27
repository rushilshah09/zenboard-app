// First-run onboarding. Standalone (outside the (app) shell) so it's full-screen.
// Authed: no user → /login; already onboarded → /today (so it can't be re-entered).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('full_name, onboarding_complete').eq('id', user.id).maybeSingle();
  if (profile?.onboarding_complete) redirect('/today');

  const suggestedName = profile?.full_name?.trim() || user.email?.split('@')[0] || '';
  return <OnboardingFlow email={user.email ?? ''} suggestedName={suggestedName} />;
}
