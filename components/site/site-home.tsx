// ── ZENBOARD.COM — THE HOME PAGE ────────────────────────────────────────────
//
// The website says what the product says to itself (PRODUCT_THINKING.md): "Open Zenboard. Know what
// matters. Do the work." It is the operating system for a creative business, and its measure is how
// much work it takes off the day.
//
// Its look comes from the product, not from another website:
//   · THE MARK IS THE GRID. The page is one lattice of rounded cells, the line showing between them,
//     and where four cells meet their corners leave the star at the heart of the Zenboard mark. The
//     product areas all split the grid at the same column, so one line runs down the middle of the
//     page and every joint on it is a whole star;
//   · THE GRADIENTS ARE PRINTED. Where a page would put a colour cloud, this one prints the mark in a
//     halftone of its own glyphs (dot, joint, heart, mark), moving a little while it is on screen;
//   · THE PRODUCT IS THE PICTURE. Every picture is Zenboard's own components on sample data, and most
//     of them can be used: tick a task, pick a highlight, approve, record a payment;
//   · ONE THING EXPLAINS THE REST. A single request travels through the product, from a client's ask to
//     her payment (loop.tsx), because the intersection of the parts is the product;
//   · the words: Rubik for what the page SAYS (the product's title face), Geist for everything you
//     operate or scan. One filled button per screen: the hero's.
//
// Motion is scroll-linked and progressive (globals.css): nothing waits on a script to be readable, and
// less motion means nothing moves or advances on its own.

import Link from 'next/link';
import * as React from 'react';
import { ArrowRight, Check, CursorClick, Keyboard, Receipt } from '@/components/ds/icons';
import { Avatar, Icon, Mark, button, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { DayArea, MoneyArea, PortalArea, ProjectsArea } from './areas';
import { Bento } from './bento';
import { CookieConsent } from './cookie-consent';
import { Halftone } from './halftone';
import { LiveHome } from './live-home';
import { Loop } from './loop';
import { People } from './people';
import { Questions, SIGN_UP, SiteFooter, SiteNav } from './site-chrome';
import { MEASURE } from './measure';
import { FACES } from './faces';
import { Cell, Eyebrow, Grid, Row } from './visual';

function Hero() {
  const step = (n: number) => ({ '--rise-step': n }) as React.CSSProperties;
  return (
    <Row aria-labelledby="hero-title">
      {/* The words on the page's own ground, and the mark printed large beside them: whole, stirring
          slowly under the halftone's wave, and thinning out toward the words so they always read first.
          Nothing else: the product has the next cell to itself. */}
      <Cell pad className="overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28">
        {/* HALF A MARK, not a whole one (user, 2026-09-26: "don't show full logo, show half cut
            logo overflow"). A complete mark sitting inside the frame is a picture OF the logo;
            one that runs off the edge is the same shape the rest of this page uses — something
            larger than the window, seen in part. Centred on the right edge at nearly twice the
            cell's short side, so about half of it is in frame and it is cut top and bottom too. */}
        <Halftone mark={{ x: 0.92, y: 0.5, size: 1.12 }} fade="start" />
        <div className="relative max-w-[42rem]">
          <p className="site-rise zb-enter flex items-center gap-2 text-ui font-medium text-ink-800">
            <Mark size={16} tone="brand" />
            For people who run a creative business
          </p>
          {/* One sentence to a line: the three steps of a day, read as three steps. On a phone the longest
              wraps inside itself, and never runs on into the next ("matters. Do the / work."). */}
          <h1 id="hero-title" className="site-rise zb-enter mt-6 font-editorial text-headline text-ink-900 sm:text-hero" style={step(1)}>
            <span className="block">Open Zenboard. </span>
            <span className="block">Know what matters. </span>
            <span className="block">Do the work.</span>
          </h1>
          <p className="site-rise zb-enter mt-6 max-w-[50ch] text-body-lg text-ink-600" style={step(2)}>
            Your day, your clients, your documents and your money in one calm workspace. It’s all connected,
            so the work around the work gets out of your way.
          </p>
          <div className="site-rise zb-enter mt-8 flex flex-wrap items-center gap-3" style={step(3)}>
            <Link href={SIGN_UP} className={button({ variant: 'primary', size: 'lg' })}>Start free</Link>
            <a href="#how" className={cn(button({ variant: 'ghost', size: 'lg' }), 'group')}>
              See how it works
              <Icon icon={ArrowRight} size={16} className="transition-transform duration-fast ease-out-quiet group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </Cell>
    </Row>
  );
}

/** A piece of the product resting on the showcase, lifted a little further than the app, drifting. */
function Resting({ className, drift = 0, children }: { className?: string; drift?: number; children: React.ReactNode }) {
  return (
    <div aria-hidden inert className={cn('site-reveal pointer-events-none absolute z-10 select-none max-xl:hidden', className)}>
      <div
        className={cardClass('site-lift site-drift flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-caption')}
        style={{ '--drift-at': `calc(var(--site-shimmer) * ${-drift})` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/** THE PRODUCT, WHOLE: Home as it opens every morning, sidebar and all, working, on a picture in three
    layers (the hero's gradient, the mark printed over it in light, the app on top). It lies flat as you
    scroll to it, and three pieces of the product rest on its edges, the way they arrive in the day.
    It is an ordinary cell (2026-09-26): it was briefly the page's one full-bleed band, and the user's
    answer was to take the frame off the WHOLE page instead ("don't extend this section … I want extend
    from both sides, all sections", site-chrome.tsx `MEASURE`). Its inset is a cell's own, so the
    gradient starts on the same column every other section's words do. */
function Showcase() {
  return (
    <Row aria-label="Zenboard’s Home, working">
    <Cell className="site-field site-field-hero site-pad overflow-hidden pb-6 pt-8 sm:pb-12 sm:pt-12 lg:pb-16 lg:pt-16">
      <Halftone mark={{ x: 0.5, y: 0.56, size: 1.9 }} />
      <p className="site-reveal relative mx-auto mb-4 flex w-full max-w-[1180px] items-center gap-1.5 text-caption text-ink-700">
        <Icon icon={CursorClick} size={14} />Try it: tick a task, or pick today’s highlight.
      </p>
      <div className="relative mx-auto w-full max-w-[1180px]">
        <div className="site-tilt">
          <div className="site-glass rounded-xl">
            <LiveHome fluid />
          </div>
        </div>
        <Resting className="-start-12 bottom-24" drift={0}>
          <Avatar name="Priya Nair" src={FACES.priya} size="sm" decorative />
          <p className="text-ink-800"><span className="font-medium text-ink-900">Priya</span> approved the logo presentation</p>
          <span className="ms-1 text-ink-500">now</span>
        </Resting>
        <Resting className="-end-12 top-28" drift={0.35}>
          <Icon icon={Receipt} size={16} weight="fill" className="text-ink-500" />
          <span className="font-medium text-ink-900">INV-021 paid · $4,200</span>
          <Icon icon={Check} size={14} className="text-success-600" />
        </Resting>
        <Resting className="-end-8 bottom-10" drift={0.65}>
          <span className="site-pulse size-1.5 rounded-full bg-success-600" />
          <span className="font-medium text-ink-900">Now · Ridgeline call</span>
          <span className="text-ink-500">11:30</span>
        </Resting>
      </div>
    </Cell>
    </Row>
  );
}

function Details() {
  return (
    <Row id="details" aria-labelledby="details-title">
      <Cell pad className="py-14 sm:py-16 lg:py-20">
        <div className="site-reveal grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow hue="periwinkle" icon={Keyboard}>The details</Eyebrow>
            <h2 id="details-title" className="mt-6 text-balance font-editorial text-h1 text-ink-900 sm:text-headline">Small things, done properly.</h2>
          </div>
          <p className="max-w-[44ch] text-body-lg text-ink-600">The parts you use a hundred times a day, made to be quick and to stay out of the way.</p>
        </div>
      </Cell>
      <Bento />
    </Row>
  );
}

function Faq() {
  return (
    <Row id="faq" aria-labelledby="faq-title">
      <Cell pad className="py-14 sm:py-16 lg:col-span-4 lg:py-20">
        <div className="site-reveal">
          <p className="text-ui font-medium text-ink-500">Questions</p>
          <h2 id="faq-title" className="mt-6 text-balance font-editorial text-h1 text-ink-900 sm:text-headline">The things people ask first.</h2>
        </div>
      </Cell>
      <Cell pad className="pb-14 pt-4 sm:pb-16 lg:col-span-8 lg:pt-16">
        <div className="site-reveal"><Questions /></div>
      </Cell>
    </Row>
  );
}

export function SiteHome() {
  return (
    // `isolate`: the lines that run past the sections are drawn behind them, and this is the ground
    // they are drawn on.
    <div className="relative isolate min-h-dvh overflow-x-clip bg-background">
      {/* The grid's two outer rules, the height of the page: above the grid and below it, past the
          navigation and the footer, they are the page's only lines. */}
      <div aria-hidden className="site-guides"><div className={cn(MEASURE, 'h-full')}><div className="h-full border-x border-line" /></div></div>
      <SiteNav />
      <main className={MEASURE}>
        <Grid>
          <Hero />
          <Showcase />
          <Loop />
          <People />
          <DayArea />
          <ProjectsArea />
          <PortalArea />
          <MoneyArea />
          <Details />
          <Faq />
        </Grid>
      </main>
      <SiteFooter />
      <CookieConsent />
    </div>
  );
}
