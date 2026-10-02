// ── ZENBOARD.COM — THE HOME PAGE ────────────────────────────────────────────
//
// The website says one thing (the website and SEO plan, 2026-09-27): ONE CALM WORKSPACE TO RUN YOUR
// BUSINESS. You should not need five apps to run it; Zenboard brings the work and the business side of
// it into one place, and its measure is how much switching it takes out of the day. (It said "for a
// creative business" until the plan widened it to everyone who runs a business and does the work.)
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
// Motion (globals.css, "the website arrives as it is read"; site-motion.tsx): the first screen arrives
// on CSS alone, a heading a word at a time; everything below it arrives as it scrolls into view, and
// each section's rule draws out to the window's edges. The grid's line lights up where the pointer is.
// Nothing waits on a script to be readable, and less motion means nothing moves or advances on its own.

import Link from 'next/link';
import * as React from 'react';
import { ArrowRight, Check, CursorClick, Keyboard, Question, Receipt } from '@/components/ds/icons';
import { Avatar, Icon, Mark, button, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { DayArea, MoneyArea, ProjectsArea } from './areas';
import { HubSection } from './hub-section';
import { PortalSection } from './portal-section';
import { Bento } from './bento';
import { Halftone } from './halftone';
import { AppWindow } from './app-window';
import { Loop } from './loop';
import { People } from './people';
import { Questions, SIGN_UP, SIGN_UP_LABEL } from './site-chrome';
import { SiteShell } from './site-shell';
import { WaitlistSection } from './waitlist/waitlist-section';
import { FACES } from './faces';
import { Cell, Eyebrow, Mesh, Row } from './visual';
import { Title, Words } from './words';
import { FAQ } from './faq-data';
import { faqPage, organization, softwareApplication, website } from '@/lib/structured-data';

/** The app in one line, as its structured data describes it. */
const APP_LINE = 'One calm workspace to run your business: tasks, projects, calendar, documents, clients and invoices in one place.';

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
            cell's short side, so about half of it is in frame and it is cut top and bottom too.
            It answers the pointer (halftone.tsx): the print swells and catches the brand's colour
            where the visitor points. */}
        <Halftone mark={{ x: 0.92, y: 0.5, size: 1.12 }} fade="start" />
        <div className="relative max-w-[42rem]">
          {/* Two lines on a phone: balanced so no word is left alone, the mark on the first line. */}
          <p className="site-rise zb-enter flex items-start gap-2 text-balance text-ui font-medium text-ink-800">
            <Mark size={16} tone="brand" className="mt-0.5" />
            For freelancers, founders and small businesses
          </p>
          {/* THE ONE LINE (the plan's positioning), split where the sentence breaks: what it is, then what it
              is for. On a phone each half wraps inside itself and never runs on into the next. It arrives
              a word at a time; the words are counted on across the lines. */}
          <h1 id="hero-title" className="site-rise-words zb-enter mt-6 font-editorial text-hero-sm text-ink-900 sm:text-hero" style={step(1)}>
            <span className="block"><Words>One calm workspace</Words> </span>
            <span className="block"><Words from={3}>to run your business.</Words></span>
          </h1>
          {/* The problem in the reader's words, then the promise. After the heading's last words have started. */}
          <p className="site-rise zb-enter mt-6 max-w-[540px] text-lead leading-6 text-ink-600" style={step(5)}>
            You shouldn’t need five apps to run your business. Zenboard brings your tasks, projects, calendar,
            documents, clients and money together, so you spend less time switching and more time on the work.
          </p>
          <div className="site-rise zb-enter mt-8 flex flex-wrap items-center gap-3" style={step(6)}>
            <Link href={SIGN_UP} className={button({ variant: 'primary', size: 'lg' })}>{SIGN_UP_LABEL}</Link>
            <a href="#how" className={cn(button({ variant: 'ghost', size: 'lg' }), 'group')}>
              See how it works
              <Icon icon={ArrowRight} size={16} nudge="end" />
            </a>
          </div>
          {/* RISK REVERSAL, and only what the page already commits to. "Start free" said what to do
              and never what it costs you, which is the friction a marketing page is supposed to
              remove (user, 2026-09-28: "every section should … build trust, and move users toward
              conversion"). Both facts are ones the site already states — the button's own word, and
              the setting-up answer in the FAQ that the footer repeats — so this promises nothing
              new. It deliberately does NOT say "no credit card": the site makes no pricing claim
              anywhere, and inventing one on a landing page is the kind of trust you only spend
              once. */}
          <p className="site-rise zb-enter mt-4 text-ui text-ink-500" style={step(7)}>
            Free to start. Setting up takes about two minutes.
          </p>
        </div>
      </Cell>
    </Row>
  );
}

/** A piece of the product resting on the showcase, lifted a little further than the app, drifting. It
    lands just after the app does (`step`), the way these things arrive in the day. */
function Resting({ className, drift = 0, step, children }: { className?: string; drift?: number; step: number; children: React.ReactNode }) {
  return (
    // `z-[1]`: above the app it rests on, and BELOW the sticky navigation (`z-sticky`, 10). At 10 it
    // tied with the navigation and, coming later in the page, painted over it while scrolling.
    <div aria-hidden inert className={cn('site-rise-lift zb-enter pointer-events-none absolute z-[1] select-none max-xl:hidden', className)} style={{ '--rise-step': step } as React.CSSProperties}>
      <div
        className={cardClass('site-lift site-drift flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-caption')}
        style={{ '--drift-at': `calc(var(--site-shimmer) * ${-drift})` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/** THE PRODUCT, WHOLE: the app itself in a window (app-window.tsx), the product's own views on a sample
    studio's day, walled off so nothing a visitor does leaves their browser (user, 2026-09-28: "like
    Notion, a real dashboard application demo, not a fake one"). It stands on the one picture recipe
    (the brand's rose warming into the day, the mark printed over it in light). It lies flat as you
    scroll to it, and three pieces of the product rest on its edges, the way they arrive in the day.
    It is an ordinary cell (2026-09-26): it was briefly the page's one full-bleed band, and the user's
    answer was to take the frame off the WHOLE page instead ("don't extend this section … I want extend
    from both sides, all sections", site-chrome.tsx `MEASURE`). Its inset is a cell's own, so the
    gradient starts on the same column every other section's words do. */
function Showcase() {
  return (
    <Row id="product" aria-label="Zenboard’s Home, working">
    <Cell className="site-field site-field-hero site-pad overflow-hidden pb-6 pt-8 sm:pb-12 sm:pt-12 lg:pb-16 lg:pt-16">
      <Mesh />
      <Halftone mark={{ x: 0.5, y: 0.56, size: 1.9 }} pitch={7} className="site-screen" />
      {/* Part of the first screen, so it arrives with it: after the hero's buttons, the app itself. */}
      <p className="site-rise zb-enter relative mx-auto mb-4 flex w-full max-w-[1180px] items-center gap-1.5 text-caption text-ink-700" style={{ '--rise-step': 8 } as React.CSSProperties}>
        <Icon icon={CursorClick} size={14} />This is Zenboard itself, on a sample studio’s day. Try anything: nothing you do here is saved.
      </p>
      <div className="site-rise-lift zb-enter relative mx-auto w-full max-w-[1180px]" style={{ '--rise-step': 9 } as React.CSSProperties}>
        <div className="site-tilt">
          <div className="site-glass rounded-xl">
            <AppWindow />
          </div>
        </div>
        <Resting className="-start-16 -bottom-7" drift={0} step={14}>
          <Avatar name="Priya Nair" src={FACES.priya} size="sm" decorative />
          <p className="text-ink-800"><span className="font-medium text-ink-900">Priya</span> approved the logo presentation</p>
          <span className="ms-1 text-ink-500">now</span>
        </Resting>
        <Resting className="-end-14 -top-6" drift={0.35} step={15}>
          <Icon icon={Receipt} size={16} weight="fill" className="text-ink-500" />
          <span className="font-medium text-ink-900">INV-021 paid · $4,200</span>
          <Icon icon={Check} size={14} className="text-success-600" />
        </Resting>
        <Resting className="-bottom-8 end-24" drift={0.65} step={16}>
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
      <Cell pad className="site-head">
        <div data-reveal-group className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow hue="petal" icon={Keyboard} data-reveal="rise">The details</Eyebrow>
            <h2 id="details-title" data-reveal="words" className="mt-6 text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline"><Title then="done properly.">Small things,</Title></h2>
          </div>
          <p data-reveal="rise" className="max-w-[416px] text-lead leading-6 text-ink-600">The parts you use a hundred times a day, made to be quick and to stay out of the way.</p>
        </div>
      </Cell>
      <Bento />
    </Row>
  );
}

function Faq() {
  return (
    <Row id="faq" aria-labelledby="faq-title">
      {/* The heading on the left, as tall as all the questions beside it (one grid row each). */}
      <Cell pad className="site-head lg:col-span-4 lg:row-span-6">
        <div data-reveal-group>
          <Eyebrow hue="neutral" icon={Question} data-reveal="rise">Questions</Eyebrow>
          <h2 id="faq-title" data-reveal="words" className="mt-6 text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline"><Title then="people ask first.">The things</Title></h2>
        </div>
      </Cell>
      {/* Each question a card of its own on the right, joined by the grid's star (site-chrome.tsx). */}
      <Questions />
    </Row>
  );
}

export function SiteHome() {
  return (
    // What search engines read: who makes it, the app and its free offer, and the questions below.
    <SiteShell jsonLd={[organization(), website(), softwareApplication(APP_LINE), faqPage(FAQ)]}>
      <Hero />
      <Showcase />
      <HubSection />
      <Loop />
      <People />
      <DayArea />
      <ProjectsArea />
      <PortalSection />
      <MoneyArea />
      <Details />
      {/* The conversion moment, after the product has been shown and before the questions that
          follow it: someone who has read this far is deciding, and the questions below are the
          objections they are deciding against. */}
      <WaitlistSection source="hero" />
      <Faq />
    </SiteShell>
  );
}
