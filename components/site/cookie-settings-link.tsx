'use client';
// "Cookie settings", wherever a page needs to offer it: a button styled as the words around it, that
// opens the one cookie settings dialog (cookie-consent.tsx listens for it on every page).

import * as React from 'react';
import { cn } from '@/lib/cn';
import { openCookieSettings } from '@/lib/consent';

export function CookieSettingsLink({ className, children = 'Cookie settings' }: { className?: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={cn('focus-ring zb-nopress rounded-xs text-ink-900 underline underline-offset-2', className)}
    >
      {children}
    </button>
  );
}
