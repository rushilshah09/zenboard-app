'use client';
// Dev-only harness for the §7U onboarding-as-ritual — staged props so the three
// question-steps, role/rate disclosure, and the keys card can be verified
// without a session. Server actions reject (no auth); the flow/validation is
// what's under test. 404s in prod.
import { notFound } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <OnboardingFlow email="darshil@studio.co" suggestedName="Darshil" />;
}
