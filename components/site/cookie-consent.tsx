'use client';
// ── COOKIES: THE BANNER AND THE SETTINGS ───────────────────────────────────
//
// The first visit asks once, in a card at the foot of the window: essential cookies keep Zenboard
// working and are always on; anything optional stays off unless it is allowed. The choice is stored
// (lib/consent.ts) and the question is not asked again for a year.
//
// Written to be safe rather than persuasive:
//   · "Decline" and "Accept all" are the SAME button, side by side — from 2026-09-27 both are
//     `brandOutline`, so the card carries the brand (user: "in brand, add accent") as an EDGE on
//     BOTH rather than a fill on one. That is not a compromise, it is the only version that is
//     legal: the EDPB asks that refusing be as easy as agreeing, and CNIL has fined a coloured
//     Accept sitting beside a grey Decline. `lib/legal.test.ts` enforces the parity, and now also
//     that neither of the pair is the FILLED accent — so the nudge cannot come back by accident;
//   · the one filled accent on this surface is "Save choices" in the settings dialog, which is
//     neutral: it commits whatever the reader chose, and favours no answer;
//   · closing the card is a decline, not a "maybe later" that leaves optional cookies undecided;
//   · a browser that sends Global Privacy Control has already answered: it is recorded as a decline
//     and the card never shows;
//   · the settings are reachable from every page's footer, so a choice can be changed or withdrawn.
//
// Nothing optional runs today, and the copy says so; this is the switch anything optional will have
// to go through when it does.

import Link from 'next/link';
import * as React from 'react';
import { ChevronRight, X } from '@/components/ds/icons';
import { Button, Icon, IconButton, Switch, cardClass } from '@/components/ds/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ds/ui/dialog';
import {
  CONSENT_EVENT, CONSENT_SETTINGS_EVENT, ESSENTIAL_ONLY, EVERYTHING, globalPrivacyControl, readConsent, writeConsent,
  type ConsentChoice,
} from '@/lib/consent';

/** The card plays its exit BEFORE the choice is written, so dismissing reads as the card leaving
 *  rather than blinking out of existence. Must match `.site-consent[data-leaving]` in globals.css,
 *  which runs for `--duration-fast`. */
const EXIT_MS = 100;

/** Whether a choice is stored, read from the cookie itself and re-read whenever the choice changes. */
const subscribe = (onChange: () => void) => {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
};
const stored = () => (readConsent() ? 'chosen' : 'open');
const onServer = () => 'server';

const OPTIONAL: { key: keyof ConsentChoice; title: string; body: string }[] = [
  {
    key: 'analytics',
    title: 'Analytics',
    body: 'Help us understand how people use this site, so we can make it better. We don’t use any today; if we start, they will only run with your permission.',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    body: 'Measure whether our advertising works. We don’t use any today; if we start, they will only run with your permission.',
  },
];

export function CookieConsent() {
  const state = React.useSyncExternalStore(subscribe, stored, onServer);
  const [settings, setSettings] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const exitTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(exitTimer.current), []);
  const [choice, setChoice] = React.useState<ConsentChoice>(ESSENTIAL_ONLY);

  // A browser sending Global Privacy Control has answered already: record it as a decline.
  React.useEffect(() => {
    if (state === 'open' && globalPrivacyControl()) writeConsent(ESSENTIAL_ONLY);
  }, [state]);

  const openSettings = React.useCallback(() => {
    const now = readConsent();
    setChoice(now ? { analytics: now.analytics, marketing: now.marketing } : ESSENTIAL_ONLY);
    setSettings(true);
  }, []);

  // The footer's "Cookie settings", on every page.
  React.useEffect(() => {
    window.addEventListener(CONSENT_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(CONSENT_SETTINGS_EVENT, openSettings);
  }, [openSettings]);

  const decide = (c: ConsentChoice) => {
    writeConsent(c);
    setSettings(false);
  };

  /** The BANNER's choice: play the exit, then record it. The dialog does not go through here —
   *  Radix owns that surface's exit. */
  const dismissBanner = (c: ConsentChoice) => {
    if (leaving) return; // a second click must not queue a second write
    setLeaving(true);
    exitTimer.current = window.setTimeout(() => writeConsent(c), EXIT_MS);
  };

  const banner = state === 'open' && !settings && !globalPrivacyControl();

  return (
    <>
      {banner && (
        <div role="region" aria-label="Cookie choice" className="fixed inset-x-3 bottom-3 z-toast sm:inset-x-auto sm:bottom-6 sm:start-6 sm:w-[34rem]">
          <div data-leaving={leaving || undefined} className={cardClass('site-consent relative rounded-xl p-5 shadow-overlay sm:p-6')}>
            <IconButton
              label="Close, and keep only essential cookies"
              size="sm"
              variant="ghost"
              className="absolute end-3 top-3"
              icon={<Icon icon={X} size={16} />}
              onClick={() => dismissBanner(ESSENTIAL_ONLY)}
            />
            <p className="pe-8 text-ui leading-relaxed text-ink-700">
              Zenboard uses essential cookies to run this site and keep you signed in. With your permission, we
              would also use optional cookies to understand how the site is used. Choose “Decline” to keep only
              the essential ones, or “Cookie settings” to decide for yourself. Read our{' '}
              <Link href="/legal/cookie-notice" className="focus-ring rounded-xs text-ink-900 underline underline-offset-2">cookie notice</Link>.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="brandOutline" onClick={() => dismissBanner(ESSENTIAL_ONLY)}>Decline</Button>
              <Button variant="brandOutline" onClick={() => dismissBanner(EVERYTHING)}>Accept all</Button>
              {/* The chevron moves on the SAME duration and curve the button's own label colour uses
                  (`transition-colors duration-fast ease-hover`, button.tsx). It was `ease-out-quiet`:
                  two different curves inside one hover, which is what made this hover read as off —
                  the ink settled on one timing while the glyph slid on another. */}
              <Button variant="ghost" className="group ms-auto" onClick={openSettings}>
                Cookie settings
                <Icon icon={ChevronRight} size={16} className="transition-transform duration-fast ease-hover group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="max-w-[32rem]">
          <DialogHeader>
            <DialogTitle>Cookie settings</DialogTitle>
            <DialogDescription>
              Choose which cookies Zenboard may use on this device. You can change this at any time from “Cookie
              settings” at the foot of every page.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col divide-y divide-line-soft border-y border-line-soft">
            <li className="flex items-start gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-ui font-medium text-ink-900">Strictly necessary</p>
                <p className="mt-1 text-caption leading-relaxed text-ink-600">
                  Sign you in, keep your session secure and remember this choice. The site cannot work without them,
                  so they are always on.
                </p>
              </div>
              <Switch checked disabled aria-label="Strictly necessary cookies are always on" />
            </li>
            {OPTIONAL.map((o) => (
              <li key={o.key} className="flex items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-medium text-ink-900">{o.title}</p>
                  <p className="mt-1 text-caption leading-relaxed text-ink-600">{o.body}</p>
                </div>
                <Switch
                  checked={choice[o.key]}
                  onCheckedChange={(on) => setChoice((c) => ({ ...c, [o.key]: on }))}
                  aria-label={`${o.title} cookies`}
                />
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => decide(ESSENTIAL_ONLY)}>Decline all</Button>
              <Button variant="secondary" onClick={() => decide(EVERYTHING)}>Accept all</Button>
            </div>
            <Button variant="brand" onClick={() => decide(choice)}>Save choices</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
