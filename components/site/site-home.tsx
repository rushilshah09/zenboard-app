// ── ZENBOARD.COM — THE HOME PAGE ────────────────────────────────────────────
//
// The website says what the product already says to itself (PRODUCT_THINKING.md): "Open Zenboard.
// Know what matters. Do the work." It is the operating system for a creative business, not another
// project tool, and its measure is how much work it removes from the day.
//
// What each part of the page answers to (the references were Linear, Notion and Miro, studied for
// how they work, not copied):
//   · the product is shown with its OWN components (./stills), the way Linear's site is built from
//     Linear — a screenshot goes stale, these cannot;
//   · every product picture lies on the DESK, as a sheet, the same object the sign-in screen uses,
//     so the site and the first screen of the app are one visual world;
//   · headlines speak in the editorial serif, everything you operate in Geist (IDENTITY_BRIEF.md);
//   · one berry element per view: the hero's "Start free", the closing "Start free", and the
//     illustration's mark each sit alone on their screen (CLAUDE.md rule 2);
//   · the hero arrives in order, once — a first visit may carry a staged entrance (Emil), and a
//     keyboard arrival skips it (`zb-enter`).

import Link from 'next/link';
import * as React from 'react';
import { Illustration, Logo, Mark, button, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { DocStill, FinanceStill, HomeStill, PortalStill, ProjectsStill } from './stills';

const SIGN_UP = '/login';
const LOG_IN = '/login';

/** The one outer column. Wider than the app's reading width: a website is looked at, then read. */
function Column({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-4 sm:px-8', className)}>{children}</div>;
}

/**
 * The desk: the ground every product picture lies on (`bg-surface-desk`, one rung below the page).
 * `bleed` drops the right and bottom gutters, so the picture runs off the desk's edge.
 */
function Desk({ bleed, className, children }: { bleed?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('overflow-hidden rounded-xl bg-surface-desk', bleed ? 'ps-4 pt-4 sm:ps-8 sm:pt-8 lg:ps-12 lg:pt-12' : 'p-4 sm:p-8 lg:p-12', className)}>
      {children}
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-sticky border-b border-line-soft bg-background">
      <Column className="flex h-16 items-center gap-6">
        <Link href="/" aria-label="Zenboard home" className="focus-ring rounded-md"><Logo height={24} /></Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {[['Your day', '#day'], ['Clients', '#clients'], ['Documents', '#documents'], ['Money', '#money']].map(([label, href]) => (
            <a key={href} href={href} className={button({ variant: 'ghost', size: 'sm' })}>{label}</a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <Link href={LOG_IN} className={button({ variant: 'ghost', size: 'sm' })}>Log in</Link>
          {/* Secondary on purpose: the hero's own "Start free" is this screen's one filled button. */}
          <Link href={SIGN_UP} className={button({ variant: 'secondary', size: 'sm' })}>Start free</Link>
        </div>
      </Column>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="pt-16 sm:pt-24">
      <Column>
        <p className="site-rise zb-enter text-ui font-medium text-ink-500">For people who run a creative business</p>
        {/* One sentence to a line: the three steps of every day, read as three steps. On a phone they
            wrap where they must. */}
        <h1 id="hero-title" className="site-rise zb-enter mt-4 font-editorial text-headline text-ink-900 sm:text-hero" style={{ '--rise-step': 1 } as React.CSSProperties}>
          <span className="sm:block">Open Zenboard. </span>
          <span className="sm:block">Know what matters. </span>
          <span className="sm:block">Do the work.</span>
        </h1>
        <p className="site-rise zb-enter mt-6 max-w-[56ch] text-body-lg text-ink-600" style={{ '--rise-step': 2 } as React.CSSProperties}>
          Your day, your clients, your documents and your money in one calm workspace. It’s all connected,
          so the work around the work gets out of your way.
        </p>
        <div className="site-rise zb-enter mt-8 flex flex-wrap items-center gap-3" style={{ '--rise-step': 3 } as React.CSSProperties}>
          <Link href={SIGN_UP} className={button({ variant: 'primary', size: 'lg' })}>Start free</Link>
          <a href="#day" className={button({ variant: 'ghost', size: 'lg' })}>See how a day works</a>
        </div>
      </Column>

      {/* The product itself, at its real size, on the desk. The window cuts it on the right and at
          the bottom, the way a screen says "there is more of me" (the sign-in screen's rule). */}
      <Column className="mt-14 sm:mt-16">
        <div className="site-rise zb-enter relative" style={{ '--rise-step': 4 } as React.CSSProperties}>
          <Desk bleed className="h-[420px] sm:h-[560px]">
            <HomeStill className="rounded-e-none rounded-b-none" />
          </Desk>
        </div>
      </Column>
    </section>
  );
}

const PROMISES = [
  { title: 'Know what matters', body: 'Every morning starts with one highlight and a plan that fits the hours you actually have.' },
  { title: 'Everything connected', body: 'A task knows its project, its client, its brief and its invoice. Nothing lives in a folder you have to remember.' },
  { title: 'Calm by design', body: 'One accent colour, no badges shouting for attention, nothing to tidy. It stays out of the way.' },
];

function Promises() {
  return (
    <section aria-label="What Zenboard is for" className="py-20 sm:py-24">
      <Column className="grid gap-10 sm:grid-cols-3 sm:gap-8">
        {PROMISES.map((p) => (
          <div key={p.title} className="border-t border-line pt-5">
            <h2 className="text-title-4 text-ink-900">{p.title}</h2>
            <p className="mt-2 max-w-[36ch] text-body text-ink-600">{p.body}</p>
          </div>
        ))}
      </Column>
    </section>
  );
}

/** A chapter: what it is, in words, then the product doing it. */
function Chapter({ id, eyebrow, title, body, children }: {
  id: string; eyebrow: string; title: string; body: string; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-14 sm:py-20">
      <Column>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div>
            <p className="text-ui font-medium text-ink-500">{eyebrow}</p>
            <h2 id={`${id}-title`} className="mt-3 max-w-[20ch] text-balance font-editorial text-display text-ink-900 sm:text-headline">{title}</h2>
          </div>
          <p className="max-w-[52ch] text-body-lg text-ink-600">{body}</p>
        </div>
        <div className="mt-10">{children}</div>
      </Column>
    </section>
  );
}

const REPLACED = ['A to-do app', 'A notes app', 'An invoice spreadsheet', 'A client portal', 'A chat thread'];

function Replaces() {
  return (
    <section aria-labelledby="replaces-title" className="py-20 sm:py-24">
      <Column>
        <Desk className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <h2 id="replaces-title" className="max-w-[18ch] text-balance font-editorial text-display text-ink-900 sm:text-headline">One place instead of five tabs.</h2>
            <p className="mt-4 max-w-[48ch] text-body-lg text-ink-600">
              Most studios run on tools that don’t know about each other. In Zenboard every task, document,
              invoice and message knows which client and project it belongs to.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {REPLACED.map((r) => (
              <li key={r} className={cardClass('flex h-11 items-center px-4 text-ui text-ink-500 line-through decoration-ink-500')}>
                {r}
              </li>
            ))}
            <li className={cardClass('flex h-12 items-center gap-2.5 px-4 text-ui font-medium text-ink-900 shadow-panel')}>
              <Mark size={18} tone="brand" />
              Zenboard
            </li>
          </ul>
        </Desk>
      </Column>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="closing-title" className="pb-24 pt-8 sm:pb-32">
      <Column>
        {/* The rule sits on the content, not the column, so it starts and ends where the words do. */}
        <div className="flex flex-col items-start gap-6 border-t border-line pt-16">
          <h2 id="closing-title" className="max-w-[16ch] text-balance font-editorial text-headline text-ink-900 sm:text-hero">Start with today.</h2>
          <p className="max-w-[52ch] text-body-lg text-ink-600">
            Setting up takes two minutes: your name, your first project, and the few things you want done today.
          </p>
          <Link href={SIGN_UP} className={button({ variant: 'primary', size: 'lg' })}>Start free</Link>
        </div>
      </Column>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line-soft">
      <Column className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2">
          <Logo height={22} />
          <p className="text-caption text-ink-500">The calm workspace for your creative business.</p>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-1 sm:ms-auto">
          <Link href={LOG_IN} className={button({ variant: 'ghost', size: 'sm' })}>Log in</Link>
          <Link href={SIGN_UP} className={button({ variant: 'ghost', size: 'sm' })}>Start free</Link>
        </nav>
        <p className="text-caption text-ink-500">© 2026 Zenboard</p>
      </Column>
    </footer>
  );
}

export function SiteHome() {
  return (
    <div className="min-h-dvh bg-background">
      <Nav />
      <main>
        <Hero />
        <Promises />

        <Chapter
          id="day"
          eyebrow="Your day"
          title="Start every morning knowing the one thing."
          body="Zenboard lays out today before you ask: the highlight, the plan, the meetings, and what is waiting on someone else. Planning takes a minute. So does closing the day."
        >
          <Desk className="grid place-items-center">
            <Illustration name="day-planned" className="max-w-[560px]" />
          </Desk>
        </Chapter>

        <Chapter
          id="clients"
          eyebrow="Projects and clients"
          title="Every project carries its client and its next move."
          body="Tasks, files, approvals and invoices hang off the project they belong to. Open a client and see what you owe them, and what they owe you."
        >
          <Desk><ProjectsStill /></Desk>
        </Chapter>

        <Chapter
          id="portal"
          eyebrow="Client portal"
          title="Give clients a page, not a thread of emails."
          body="Each project gets a private link with its progress, approvals, documents, invoices and a conversation with you. Nothing internal ever shows."
        >
          <Desk className="grid place-items-center"><PortalStill /></Desk>
        </Chapter>

        <Chapter
          id="documents"
          eyebrow="Documents"
          title="Write the brief where the work is."
          body="Briefs, proposals and meeting notes live beside the projects they are about, with the properties and checklists the work needs."
        >
          <Desk className="grid place-items-center"><DocStill /></Desk>
        </Chapter>

        <Chapter
          id="money"
          eyebrow="Money"
          title="Know what’s owed, to the cent."
          body="Invoices come from the work you tracked and add up exactly. You see what’s paid, what’s due and what’s late."
        >
          <Desk><FinanceStill /></Desk>
        </Chapter>

        <Replaces />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
