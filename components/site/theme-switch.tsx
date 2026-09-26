'use client';
// ── LIGHT OR DARK ───────────────────────────────────────────────────────────
//
// The user, 2026-09-26: "give the website a dark mode and light mode option". The website and the app
// share one appearance (lib/theme.ts), so this is the same switch as the app's Appearance menu: stored
// the same way, put in place before the next visit paints, and flipped with every transition held so
// the whole page changes at once instead of smearing through its colour transitions (better-ui).
//
// The glyph is the theme you are looking at; the label says what pressing it does. The two glyphs
// cross-fade through the motion seam's IconSwap, and a key simply swaps them.

import * as React from 'react';
import { Moon, Sun } from '@/components/ds/icons';
import { Icon, IconButton, IconSwap } from '@/components/ds/ui';
import { commitAppearance } from '@/lib/theme';
import { useResolvedTheme } from '@/lib/use-resolved-theme';

export function ThemeSwitch({ className }: { className?: string }) {
  const theme = useResolvedTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <IconButton
      label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      tooltipSide="bottom"
      size="sm"
      className={className}
      onClick={() => commitAppearance({ theme: next })}
      icon={<IconSwap swapKey={theme}><Icon icon={theme === 'dark' ? Moon : Sun} size={16} /></IconSwap>}
    />
  );
}
