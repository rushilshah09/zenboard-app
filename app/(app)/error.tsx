'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { ErrorState } from '@/components/shell/route-fallbacks';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState onRetry={unstable_retry} />;
}
