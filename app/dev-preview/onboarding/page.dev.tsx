'use client';
// Dev-only harness for the §7U onboarding-as-ritual — staged props so the three
// question-steps, role/rate disclosure, and the keys card can be verified
// without a session. Server actions reject (no auth); the flow/validation is
// what's under test. 404s in prod.
import { Suspense, useSyncExternalStore } from 'react';
import { notFound } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Toaster } from '@/components/ds/ui';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

function Staged() {
  // `?step=1` starts on a later question: the server actions reject without a session, so the
  // steps past the first are otherwise unreachable here.
  //
  // Mounted CLIENT-side only. The server pass has no search params, so it rendered step 0 while
  // the browser rendered the staged step — a hydration mismatch that blanked the page. A harness
  // is allowed to skip SSR; the product is not, which is why only this file does it.
  // `useSyncExternalStore` with a server snapshot of `false` is the sanctioned way to say "this
  // renders only in the browser" — setting state in an effect to do it cascades a render.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const step = Number(useSearchParams().get('step') ?? 0);
  if (!mounted) return null;
  return <OnboardingFlow email="darshil@studio.co" suggestedName="Darshil" initialStep={Number.isFinite(step) ? step : 0} nowHour={14} />;
}

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense fallback={null}>
      <Staged />
      {/* A rejected action toasts — mount the host where the rejection is tested. */}
      <Toaster />
    </Suspense>
  );
}
