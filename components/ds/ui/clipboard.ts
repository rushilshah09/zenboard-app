'use client';
import { toast } from './toast';

/**
 * Copy text, and say so — the one way anything in Zenboard is copied.
 *
 * A copy that fails silently is worse than no copy: an insecure origin or a denied permission leaves the
 * person walking away with whatever their clipboard held before, believing they have the new thing. Both
 * halves (the promise and its absence) are answered here, so no call site has to remember.
 */
export function copyText(text: string, message = 'Link copied.'): void {
  const copied = navigator.clipboard?.writeText(text);
  if (!copied) { toast({ message: 'Could not copy.', variant: 'error' }); return; }
  copied.then(() => toast({ message }), () => toast({ message: 'Could not copy.', variant: 'error' }));
}
