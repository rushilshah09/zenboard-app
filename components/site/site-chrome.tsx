'use client';
// ── THE WEBSITE'S CHROME: navigation, questions, footer ─────────────────────
//
// The navigation is the product's own parts: a Radix NavigationMenu for "Product" (hover or click,
// arrow keys, Escape), the DS Popover for the phone menu, the DS Accordion for questions. It is a band
// across the top of the grid, its contents on the grid's own edges, and it draws its hairline and a
// ground only once the page moves under it: the one signal that there is more above.

import Link from 'next/link';
import * as React from 'react';
import { ArrowRight, Keyboard, List, MessageCircle, Orbit, Question, Receipt, Sun } from '@/components/ds/icons';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Icon, IconButton,
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger,
  Popover, PopoverContent, PopoverTrigger, button,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { CookieSettingsLink } from './cookie-settings-link';
import { SiteLogo } from './site-logo';
import { Halftone } from './halftone';
import { GUTTER, MEASURE } from './measure';
import { Cell, Grid, Joints } from './visual';
import { Words } from './words';

export const SIGN_UP = '/login';
export const LOG_IN = '/login';

const PRODUCT = [
  { href: '/#how', icon: Orbit, title: 'How it fits together', body: 'One request, from ask to paid.' },
  { href: '/#day', icon: Sun, title: 'Your day', body: 'The highlight, the plan, and closing the day.' },
  { href: '/#projects', icon: List, title: 'Projects', body: 'Boards, your calendar, briefs and Waiting on.' },
  { href: '/#portal', icon: MessageCircle, title: 'Client portal', body: 'What your clients see, and what they don’t.' },
  { href: '/#money', icon: Receipt, title: 'Money', body: 'Invoices from your time, payments, exports.' },
  { href: '/#details', icon: Keyboard, title: 'The details', body: 'Shortcuts, focus mode, calendar and imports.' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    // Once the page moves under it, a frosted pane of the page's own ground (globals.css `.site-bar`).
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        'site-bar sticky top-0 z-sticky border-b transition-colors duration-fast ease-hover',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      {/* `ms-px` is the grid's own 1px rule: with it the wordmark starts on exactly the column the
          hero's first line does, at every breakpoint. */}
      <div className={MEASURE}>
      <div className={cn(GUTTER, 'flex h-16 w-full items-center gap-4')}>
        {/* Right-click it: copy the wordmark or the logo, or start a focus session (site-logo.tsx). */}
        <SiteLogo height={24} className="me-2 ms-px" />

        <NavigationMenu className="max-md:hidden" aria-label="Main">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Product</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[32rem] grid-cols-2 gap-1">
                  {PRODUCT.map((p) => (
                    <li key={p.href}>
                      <NavigationMenuLink asChild>
                        <a href={p.href} className="focus-ring flex gap-3 rounded-md p-3 transition-colors duration-fast ease-hover hover:bg-surface-hover">
                          <Icon icon={p.icon} size={20} weight="fill" className="shrink-0 text-ink-500" />
                          <span>
                            <span className="block text-ui font-medium text-ink-900">{p.title}</span>
                            <span className="mt-0.5 block text-caption leading-relaxed text-ink-500">{p.body}</span>
                          </span>
                        </a>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/#portal" className={button({ variant: 'ghost', size: 'sm' })}>Clients</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/#faq" className={button({ variant: 'ghost', size: 'sm' })}>Questions</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ms-auto me-px flex items-center gap-2">
          <Link href={LOG_IN} className={cn(button({ variant: 'ghost', size: 'sm' }), 'max-sm:hidden')}>Log in</Link>
          {/* The brand's own fill (user, 2026-09-26: "make accent button"): the one ACCENT-filled
              button on every screen of the site, and always in the same place. The hero's "Start free"
              is the ink fill, so the first screen still has one accent and one ink, never two berries. */}
          <Link href={SIGN_UP} className={button({ variant: 'brand', size: 'sm' })}>Start free</Link>
          <Popover>
            <PopoverTrigger asChild>
              <IconButton label="Menu" size="sm" className="md:hidden" icon={<Icon icon={List} size={16} />} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-[22rem] p-1.5">
              <nav aria-label="Main" className="flex flex-col">
                {PRODUCT.map((p) => (
                  <a key={p.href} href={p.href} className="focus-ring touch-row flex items-center gap-3 rounded-md px-3 py-2.5 text-ui text-ink-900 hover:bg-surface-hover">
                    <Icon icon={p.icon} size={16} weight="fill" className="text-ink-500" />{p.title}
                  </a>
                ))}
                <Link href="/#faq" className="focus-ring touch-row flex items-center gap-3 rounded-md px-3 py-2.5 text-ui text-ink-900 hover:bg-surface-hover">
                  <Icon icon={Question} size={16} weight="fill" className="text-ink-500" />Questions
                </Link>
                <Link href={LOG_IN} className="focus-ring touch-row mt-1 flex items-center rounded-md border-t border-line-soft px-3 py-2.5 text-ui text-ink-900 hover:bg-surface-hover">Log in</Link>
              </nav>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      </div>
    </header>
  );
}

const FAQ = [
  {
    q: 'Who is Zenboard for?',
    a: 'People who run a creative business and do the work in it: freelancers, studios and small agencies. You run your week in it; each client gets a page of their own.',
  },
  {
    q: 'What can my clients see?',
    a: 'Only what you share: progress, approvals, documents, invoices and a conversation with you, on a private link. Your notes, hours and drafts never show, and you can turn a link off at any time.',
  },
  {
    q: 'Can I bring my work from Notion?',
    a: 'Yes. Export your pages from Notion as Markdown, then choose the files in Zenboard’s importer.',
  },
  {
    q: 'Does it work with Google Calendar?',
    a: 'Yes. Connect Google Calendar and it syncs both ways, so your meetings and your plan sit on the same day.',
  },
  {
    q: 'Can clients pay invoices online?',
    a: 'Not yet. You send the invoice, your client sees it in their portal, and you record the payment when it arrives.',
  },
  {
    q: 'How long does setting up take?',
    a: 'About two minutes: your name, your first project, and the few things you want done today.',
  },
];

export function Questions() {
  return (
    <Accordion type="single" collapsible data-reveal-group className="border-t border-line">
      {FAQ.map((f) => (
        <AccordionItem key={f.q} value={f.q} data-reveal="rise" className="border-b border-line">
          <AccordionTrigger className="py-5 text-start text-body-lg font-medium text-ink-900">{f.q}</AccordionTrigger>
          <AccordionContent className="max-w-[62ch] pb-5 text-body text-ink-600">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function SiteFooter() {
  const col = (title: string, links: [string, string][]) => (
    <div data-reveal="rise">
      <p className="text-ui font-medium text-site-ink-fg">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="focus-ring group inline-flex items-center gap-1 rounded-xs text-ui text-site-ink-muted transition-colors duration-fast ease-hover hover:text-site-ink-fg">
              {label}
              <Icon icon={ArrowRight} size={12} className="-translate-x-1 opacity-0 transition-[opacity,translate] duration-fast ease-out-quiet group-hover:translate-x-0 group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    // The last row of the grid, and its one dark cell: the site's closing statement, the same in both
    // themes, printed with the mark at the size of the page.
    <footer className={cn(MEASURE, '-mt-px pb-3 sm:pb-6')}>
      {/* The page's last row: its top rule and the grid's foot both run out to the window's edges. */}
      <Grid className="site-foot">
        <Joints foot />
        <div data-reveal="rule" className="site-row col-span-full grid grid-cols-subgrid gap-px">
        <Joints />
        <Cell className="site-ink overflow-hidden bg-site-ink text-site-ink-fg">
          <Halftone mark={{ x: 0.86, y: 0.42, size: 1.25 }} fade="start" />
          {/* The closing statement arrives the way the first one did, a word at a time, and the columns
              follow it in. */}
          <div data-reveal-group className="site-pad relative grid gap-12 pb-12 pt-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16 lg:pt-24">
            <div className="flex flex-col items-start gap-6">
              <p data-reveal="words" className="max-w-[14ch] text-balance font-editorial text-headline text-site-ink-fg sm:text-hero"><Words>Open Zenboard. Do the work.</Words></p>
              <p data-reveal="rise" className="max-w-[42ch] text-body-lg text-site-ink-muted">
                Setting up takes about two minutes: your name, your first project, and the few things you want done today.
              </p>
              {/* The page's filled button, turned over for the dark cell: a light fill with dark words. The
                  DS buttons are drawn for the page's ground, so on this one their words would be ink on ink. */}
              <Link href={SIGN_UP} data-reveal="rise" className={cn(button({ variant: 'secondary', size: 'lg' }), 'border-transparent bg-site-ink-fg text-site-ink hover:bg-site-ink-fg/90 active:bg-site-ink-fg/90')}>Start free</Link>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {col('Product', [['How it fits', '/#how'], ['Your day', '/#day'], ['Projects', '/#projects'], ['Client portal', '/#portal'], ['Money', '/#money'], ['The details', '/#details']])}
              {col('Get started', [['Start free', SIGN_UP], ['Log in', LOG_IN]])}
              {col('Help', [['Questions', '/#faq']])}
              {col('Legal', [['Terms of service', '/legal/terms'], ['Privacy notice', '/legal/privacy-notice'], ['Cookie notice', '/legal/cookie-notice']])}
            </div>
          </div>
          <div className="site-pad relative flex flex-wrap items-center justify-between gap-4 border-t border-site-ink-line py-6">
            <SiteLogo height={20} className="text-site-ink-fg" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-site-ink-muted">
              <Link href="/legal" className="site-link focus-ring rounded-xs transition-colors duration-fast ease-hover hover:text-site-ink-fg">Legal</Link>
              <CookieSettingsLink className="site-link text-site-ink-muted no-underline transition-colors duration-fast ease-hover hover:text-site-ink-fg" />
              <p>© 2026 Zenboard</p>
            </div>
          </div>
        </Cell>
        </div>
      </Grid>
    </footer>
  );
}
