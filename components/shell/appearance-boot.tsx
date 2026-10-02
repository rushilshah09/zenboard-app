'use client';
// Re-applies the saved appearance right after hydration. The inline boot script
// (layout.tsx <head>) stamps <html data-theme/data-density> before first paint,
// but React 19's hydration reconciles <html> attributes back to the JSX set —
// which deliberately omits them — so a recovery render can strip the stamped
// values. This layout effect runs synchronously before the post-hydration paint
// and restores them from localStorage (the source of truth), closing the loop
// the same way next-themes' provider does. Renders nothing.
//
// And again on every change of ADDRESS: the website is drawn in one appearance
// (lib/theme.ts `SITE_APPEARANCE`) while the app wears the stored one, and a soft
// navigation between the two keeps this layout mounted, so the boot script never
// runs for the page arrived at. `applyAppearance` reads the address itself, and
// holds transitions only when the theme really changes.
import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { applyAppearance, readAppearance, watchSystemTheme } from '@/lib/theme';

export function AppearanceBoot() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const a = readAppearance();
    applyAppearance(a.theme, a.density, a.accent, a.skin);
  }, [pathname]);
  // Keeps a 'System' user in step with the OS for the life of the session.
  useLayoutEffect(() => watchSystemTheme(), []);
  return null;
}
