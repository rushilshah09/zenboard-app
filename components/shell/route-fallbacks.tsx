'use client';
// Route-level fallbacks (404 + error boundary). Same EmptyState system as every
// data surface, with Zen Shape art, so even a dead end feels like Zenboard.
import { useRouter } from 'next/navigation';
import { EmptyArt } from '@/components/illustrations/ink';
import { EmptyState } from '@/components/ui/states';

export function NotFoundState() {
  const router = useRouter();
  return (
    <main className="min-h-dvh grid place-items-center bg-paper">
      <EmptyState
        illustration={<EmptyArt name="notFound" />}
        title="This page wandered off"
        hint="The link may be old, or the page was moved. Everything else is right where you left it."
        action={{ label: 'Back to Today', onClick: () => router.push('/today') }}
        secondaryAction={{ label: 'Go back', onClick: () => router.back() }}
      />
    </main>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <div className="h-full min-h-[60dvh] grid place-items-center" role="alert">
      <EmptyState
        illustration={<EmptyArt name="error" />}
        title="Something slipped"
        hint="This view hit an unexpected error. Your work is saved — try again, or head back to Today."
        action={{ label: 'Try again', onClick: onRetry }}
        secondaryAction={{ label: 'Back to Today', onClick: () => router.push('/today') }}
      />
    </div>
  );
}
