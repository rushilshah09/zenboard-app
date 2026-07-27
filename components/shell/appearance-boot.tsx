'use client';
// Re-applies the saved appearance right after hydration. The inline boot script
// (layout.tsx <head>) stamps <html data-theme/data-density> before first paint,
// but React 19's hydration reconciles <html> attributes back to the JSX set —
// which deliberately omits them — so a recovery render can strip the stamped
// values. This layout effect runs synchronously before the post-hydration paint
// and restores them from localStorage (the source of truth), closing the loop
// the same way next-themes' provider does. Renders nothing.
import { useLayoutEffect } from 'react';
import { applyAppearance, readAppearance } from '@/lib/theme';

export function AppearanceBoot() {
  useLayoutEffect(() => {
    const a = readAppearance();
    applyAppearance(a.theme, a.density, a.accent);
  }, []);
  return null;
}
