// ── THE WEBSITE'S FRAME ─────────────────────────────────────────────────────
//
// Every page of the website stands in the same frame: the navigation, the grid with its two outer rules
// running the height of the page, the footer, the cookie choice, the focus session anyone can start from
// the logo, the way back up, and the loader's decision. The home page and the legal pages each spelled
// this out for themselves; with the site growing into its families (the website and SEO plan: product
// pages, audiences, comparisons), it is one component, so a page can only differ from another in what it
// SAYS.
//
// A server component: everything in it that needs the browser is its own client part.

import * as React from 'react';
import { Toaster } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { siteLoaderScript } from '@/lib/site-loader';
import { BackToTop } from './back-to-top';
import { CookieConsent } from './cookie-consent';
import { GuestFocus } from './guest-focus';
import { JsonLd } from './json-ld';
import { MEASURE } from './measure';
import { SiteFooter, SiteNav } from './site-chrome';
import { SiteLoader } from './site-loader';
import { SiteMotion } from './site-motion';
import { Grid } from './visual';

export function SiteShell({ jsonLd, children }: {
  /** What search engines read about the page (lib/structured-data.ts). */
  jsonLd?: React.ComponentProps<typeof JsonLd>['data'];
  /** The page's rows, laid on the grid. */
  children: React.ReactNode;
}) {
  return (
    // `isolate`: the lines that run past the sections are drawn behind them, and this is the ground
    // they are drawn on.
    <div className="relative isolate min-h-dvh overflow-x-clip bg-background">
      {jsonLd && <JsonLd data={jsonLd} />}
      {/* Decided before anything below it paints: whether this open plays the loader. */}
      <script dangerouslySetInnerHTML={{ __html: siteLoaderScript }} />
      <SiteLoader />
      <SiteMotion />
      {/* The grid's two outer rules, the height of the page: above the grid and below it, past the
          navigation and the footer, they are the page's only lines. */}
      <div aria-hidden className="site-guides"><div className={cn(MEASURE, 'h-full')}><div className="h-full border-x border-line" /></div></div>
      <SiteNav />
      <main className={MEASURE}>
        <Grid>{children}</Grid>
      </main>
      <SiteFooter />
      <CookieConsent />
      {/* The focus session anyone can start from the logo, and the one place the site says "done". */}
      <GuestFocus />
      <BackToTop />
      <Toaster />
    </div>
  );
}
