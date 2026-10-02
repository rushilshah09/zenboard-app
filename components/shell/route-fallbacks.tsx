'use client';
// Route-level fallbacks (404 + error boundary). Same EmptyState system as every
// data surface, with Zen Shape art, so even a dead end feels like Zenboard.
import { useRouter } from 'next/navigation';
import { EmptyArt } from '@/components/illustrations/ink';
import { EmptyState } from '@/components/ds/ui/states';
import { Button } from '@/components/ds/ui/button';

export function NotFoundState() {
  const router = useRouter();
  return (
    <main className="min-h-dvh grid place-items-center bg-paper">
      <EmptyState
        illustration={<EmptyArt name="notFound" />}
        title="This page wandered off"
        description="The link may be old, or the page was moved. Everything else is right where you left it."
        primary={<Button onClick={() => router.push('/today')}>Back to Today</Button>}
        secondary={<Button variant="ghost" onClick={() => router.back()}>Go back</Button>}
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
        description="This view hit an unexpected error. Your work is saved — try again, or head back to Today."
        primary={<Button onClick={onRetry}>Try again</Button>}
        secondary={<Button variant="ghost" onClick={() => router.push('/today')}>Back to Today</Button>}
      />
    </div>
  );
}
