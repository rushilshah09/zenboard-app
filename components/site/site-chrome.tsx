'use client';
// ── THE WEBSITE'S CHROME: navigation, questions, footer ─────────────────────
//
// The navigation is the product's own parts: a Radix NavigationMenu for "Product" (hover or click,
// arrow keys, Escape), the DS Popover for the phone menu, the DS Accordion for questions. It is a band
// across the top of the grid, its contents on the grid's own edges, and it draws its hairline and a
// ground only once the page moves under it: the one signal that there is more above.

import Link from 'next/link';
import * as React from 'react';
import { ArrowRight, List, Question } from '@/components/ds/icons';
import { Accordion as RA } from 'radix-ui';
import {
  Accordion, AccordionContent, AccordionTrigger, Icon, IconButton, Mark,
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger,
  Popover, PopoverContent, PopoverTrigger, button,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { SITE_PAGES, isLive, type SitePageKey } from '@/lib/site-pages';
import { CookieSettingsLink } from './cookie-settings-link';
import { FAQ } from './faq-data';
import { LifestudioLogo } from './lifestudio-logo';
import { SiteLogo } from './site-logo';
import { Halftone } from './halftone';
import { GUTTER, MEASURE } from './measure';
import { ProductMenu, ProductMenuMobile } from './nav-menu';
import { Cell, Grid, Joints } from './visual';
import { Title } from './words';

// THE FRONT DOOR IS THE WAITLIST (user, 2026-09-30). Zenboard opens a few people at a time, so the
// site's one call to action leads to /waitlist rather than straight into a sign-up form. The name is
// still SIGN_UP because that is what it is FOR — every surface that used to send someone to create an
// account now sends them to ask for a place, and there is one line to change when that reverses.
export const SIGN_UP = '/waitlist';
/** What that call to action says, everywhere it appears. One string, so no two buttons disagree. */
export const SIGN_UP_LABEL = 'Join the waitlist';
export const LOG_IN = '/login';

/**
 * THE FOOTER'S MAP OF THE SITE (user, 2026-09-29: "expand the website … update the header navigation and
 * the footer"). Every page link comes from the one page list (lib/site-pages.ts) and only while that page
 * is PUBLISHED, so the footer can never point at a page that is missing or still waiting for its review;
 * a column with nothing published in it (Compare, until legal has read those pages) is simply not drawn.
 * The labels are the pages' own breadcrumb names, so the footer and the trail agree.
 */
type FooterLink = readonly [label: string, href: string];
const published = (key: SitePageKey, label?: string): FooterLink | null =>
  isLive(SITE_PAGES[key]) ? [label ?? SITE_PAGES[key].crumb, SITE_PAGES[key].path] : null;
export const FOOTER: { title: string; links: FooterLink[] }[] = [
  { title: 'Product', links: [published('product', 'Overview'), published('clientPortal'), published('projects'), published('calendar'), published('docs'), published('invoicing')] },
  { title: 'Who it’s for', links: [published('freelancers'), published('consultants'), published('agencies'), published('smallBusinesses'), published('audiences', 'Everyone it’s for')] },
  { title: 'Compare', links: [published('vsNotion'), published('notionAlternative')] },
  { title: 'Get started', links: [[SIGN_UP_LABEL, SIGN_UP], ['Log in', LOG_IN], ['See it working', '/#product'], ['Questions', '/#faq']] },
  { title: 'Legal', links: [published('terms'), published('privacy'), published('cookies')] },
]
  .map((c) => ({ title: c.title, links: c.links.filter((l): l is FooterLink => l !== null) }))
  .filter((c) => c.links.length > 0);

/**
 * THE PRODUCT MENU moved to its own file (nav-menu.tsx), rebuilt from the user's design canvas:
 * six places in two columns with a drawing each, and an aside holding everything else Zenboard has
 * plus the launch film. What stood here showed four places explained at length and a featured
 * cell; the canvas's argument is that a menu is a list of where you can go, not a place to read.
 */

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
      <div className={GUTTER}>
      {/* The bar the Product menu spans (`panel="bar"`): its edges are the logo's and the button's. */}
      <div className="relative flex h-16 w-full items-center gap-4">
        {/* Right-click it: copy the wordmark or the logo, or start a focus session (site-logo.tsx). */}
        <SiteLogo height={24} className="me-2 ms-px" />

        <NavigationMenu panel="bar" className="max-md:hidden" aria-label="Main">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-8 px-3">Product</NavigationMenuTrigger>
              <NavigationMenuContent className="w-full p-0">
                <ProductMenu />
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/#portal" className={button({ variant: 'ghost', size: 'md' })}>Clients</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/#faq" className={button({ variant: 'ghost', size: 'md' })}>Questions</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* No light-or-dark switch: the website has one appearance (lib/theme.ts `SITE_APPEARANCE`;
            user, 2026-09-29: "right now we only keep light mode"). The app keeps its own. */}
        <div className="ms-auto me-px flex items-center gap-2">
          <Link href={LOG_IN} className={cn(button({ variant: 'ghost', size: 'md' }), 'max-sm:hidden')}>Log in</Link>
          {/* The brand's own fill (user, 2026-09-26: "make accent button"): the one ACCENT-filled
              button on every screen of the site, and always in the same place. The hero's "Start free"
              is the ink fill, so the first screen still has one accent and one ink, never two berries. */}
          <Link href={SIGN_UP} className={button({ variant: 'brand', size: 'md' })}>{SIGN_UP_LABEL}</Link>
          <Popover>
            <PopoverTrigger asChild>
              <IconButton label="Menu" size="sm" className="md:hidden" icon={<Icon icon={List} size={16} />} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-[22rem] p-1.5">
              <nav aria-label="Main" className="flex flex-col">
                {/* The same six places as the desktop menu, from the one list (nav-menu.tsx):
                    the drawings go, the words stay. */}
                <ProductMenuMobile />
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
      </div>
    </header>
  );
}

/** How many questions there are: the heading beside them spans this many of the grid's rows. */
export const FAQ_COUNT = FAQ.length;

/**
 * THE QUESTIONS, ONE CARD EACH (user, 2026-09-26, with a sketch: "each a separate card, and the spark
 * shape joining each card"; then "keep the old layout, the title on the left, the questions on the
 * right"). Every question is a cell of the page's grid, so the hairline between two questions is the
 * grid's own gutter, and where that line meets the one beside it the grid's star (the joint: what four
 * rounded corners leave where lines cross) is drawn at both ends of it. Each leads with the mark;
 * opening it turns the mark a quarter and darkens it to ink. (It lit in the brand's colour
 * until the colour system of 2026-09-28: berry is the logo, the one filled button and focus, nothing
 * else, so an open question is marked by the turn and the ink.) The accordion draws nothing
 * itself (`contents`), so its cards sit straight in the grid.
 */
export function Questions() {
  return (
    <Accordion type="single" collapsible className="contents">
      {FAQ.map((f) => (
        <RA.Item key={f.q} value={f.q} asChild>
          <Cell className="site-pad col-span-full lg:col-span-8">
            <span aria-hidden className="site-joint" data-at="start" />
            <span aria-hidden className="site-joint" data-at="end" />
            <div data-reveal="rise">
              <AccordionTrigger
                icon={
                  <span aria-hidden className="grid size-5 shrink-0 place-items-center text-ink-500 transition-[transform,color] duration-slow ease-out-quiet group-hover:text-ink-700 group-data-[state=open]:rotate-45 group-data-[state=open]:text-ink-900">
                    <Mark size={16} style={{ color: 'currentColor' }} />
                  </span>
                }
                className="h-auto min-h-16 gap-2.5 rounded-none px-0 py-5 text-body-lg font-medium text-ink-800 hover:bg-transparent hover:text-ink-900"
              >
                {f.q}
              </AccordionTrigger>
              {/* The answer hangs under the question's words: the glyph (20) and the gap (10) before them. */}
              <AccordionContent className="max-w-[calc(62ch+30px)] px-0 pb-6 ps-7.5 text-body text-ink-600">{f.a}</AccordionContent>
            </div>
          </Cell>
        </RA.Item>
      ))}
    </Accordion>
  );
}

export function SiteFooter() {
  return (
    // The last row of the grid, and its one dark cell: the site's closing statement, the same in both
    // themes, printed with the mark at the size of the page.
    <footer className={cn(MEASURE, '-mt-px pb-3 sm:pb-6')}>
      {/* The page's last row: its top rule and the grid's foot both run out to the window's edges. */}
      <Grid className="site-foot">
        <Joints foot />
        <div data-reveal="rule" className="site-row col-span-full grid grid-cols-subgrid gap-px">
        <Joints />
        {/* The page closes in the band's ink: the one dark section and the footer are the same
            colour, so the dark reads as a decision made twice rather than two unrelated blocks. */}
        <Cell className="site-band site-ink overflow-hidden">
          <Halftone mark={{ x: 0.86, y: 0.42, size: 1.25 }} fade="start" />
          {/* The closing statement arrives the way the first one did, a word at a time, and the columns
              follow it in. */}
          <div data-reveal-group className="site-pad relative grid gap-14 pb-12 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] lg:gap-16 lg:pt-24">
            <div className="flex flex-col items-start gap-6">
              {/* The logo leads the closing statement (user, 2026-09-26: "move the Zenboard logo above
                  'Open Zenboard. Do the work.'"). Right-click still offers the files and a session. */}
              <SiteLogo height={26} className="text-site-ink-fg" />
              <p data-reveal="words" className="max-w-[14ch] text-balance font-editorial text-hero-sm text-site-ink-fg sm:text-hero"><Title then="Do the work.">Open Zenboard.</Title></p>
              <p data-reveal="rise" className="max-w-[42ch] text-lead leading-6 text-site-ink-muted">
                We are opening a few people at a time. Leave your email and we will send you a numbered ticket and a note when your place comes up.
              </p>
              {/* The page's filled button, turned over for the dark cell: a light fill with dark words. The
                  DS buttons are drawn for the page's ground, so on this one their words would be ink on ink. */}
              <Link href={SIGN_UP} data-reveal="rise" className={cn(button({ variant: 'secondary', size: 'lg' }), 'border-transparent bg-site-ink-fg text-site-ink hover:bg-site-ink-fg/90 active:bg-site-ink-fg/90')}>{SIGN_UP_LABEL}</Link>
            </div>
            {/* THE SITE, MAPPED: one column per family, in the order a reader asks (what is it, is it for
                me, how does it compare, how do I start, the fine print). A nav landmark, so a screen
                reader can find it as the site's map rather than as a run of links. */}
            <nav aria-label="Footer" className={cn('grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3', FOOTER.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
              {FOOTER.map((c) => (
                <div key={c.title} data-reveal="rise">
                  <p className="text-ui font-medium text-site-ink-fg">{c.title}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {c.links.map(([label, href]) => (
                      <li key={href + label}>
                        <Link href={href} className="focus-ring group inline-flex items-center gap-1 rounded-xs text-ui text-site-ink-muted transition-colors duration-fast ease-hover hover:text-site-ink-fg">
                          {label}
                          <Icon icon={ArrowRight} size={12} className="-translate-x-1 opacity-0 transition-[opacity,translate] duration-fast ease-out-quiet group-hover:translate-x-0 group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
          {/* The foot: the fine print where the logo was, and who makes it on the other side. */}
          <div data-site-foot className="site-pad relative flex flex-wrap items-center justify-between gap-4 border-t border-site-ink-line py-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-site-ink-muted">
              <Link href="/legal" className="site-link focus-ring rounded-xs transition-colors duration-fast ease-hover hover:text-site-ink-fg">Legal</Link>
              <CookieSettingsLink className="site-link text-site-ink-muted no-underline transition-colors duration-fast ease-hover hover:text-site-ink-fg" />
              <p>© 2026 Zenboard</p>
            </div>
            <p className="flex items-center gap-2.5 text-caption text-site-ink-muted">
              A product by
              <LifestudioLogo height={16} className="text-site-ink-fg" />
            </p>
          </div>
        </Cell>
        </div>
      </Grid>
    </footer>
  );
}
