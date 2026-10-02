// ── THE WEBSITE'S PAGES, IN ONE LIST ────────────────────────────────────────
//
// The website and SEO plan (2026-09-27, claude.ai/code/artifact/e19cb780-07dd-4f4d-beaa-fbf7b096af8b):
// "SEO as a core part of the architecture, not something added later". So every public page of the
// marketing site is ONE entry here, and everything search reads is derived from it: the page's
// title and description, its canonical address, its social card, the sitemap, the breadcrumb trail,
// and the robots rules that keep the app itself out of search. A page that is not in this list
// cannot be in the sitemap, and a page in it cannot ship without a title and a description
// (`site-pages.test.ts`).
//
// Two lines per page, on purpose: the TITLE is written for the search result (the words people type,
// under 60 characters) and the page's own headline stays written for the person reading it.
//
// A plain module, not a client one: server pages read these values, and a value exported from a
// 'use client' file reaches a server component as a client reference.

import type { Metadata } from 'next';

/**
 * The site's own address, and the domain is CHOSEN now: zenboard.life (user, 2026-09-28). It was
 * the plan's first open question, and the fallback was the workers.dev address the site happened to
 * be live on — which every canonical tag, sitemap entry, social card and piece of structured data
 * was quietly inheriting. `NEXT_PUBLIC_SITE_URL` still overrides it, so a preview deploy canonicals
 * to itself rather than to production.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zenboard.life').replace(/\/+$/, '');

/** The social card every page uses unless it has its own: the homepage's first screen, 1200 × 630. */
export const SOCIAL_IMAGE = { url: '/og/zenboard.png', width: 1200, height: 630, alt: 'Zenboard: one calm workspace to run your business' };

export type SitePage = {
  /** Where it lives. Lowercase and hyphenated, no trailing slash, no dates (the plan's URL rules). */
  path: string;
  /** The search result's title, brand included: the words people search for first, 60 characters at most. */
  title: string;
  /** The search result's line under it: what the page answers, 155 characters at most. */
  description: string;
  /** The name the page takes in a breadcrumb trail. */
  crumb: string;
  /** The page above it in the trail; the homepage has none. */
  parent?: string;
  /** When what the page SAYS last changed (YYYY-MM-DD): the sitemap's lastmod. A code refactor is not a change. */
  updated: string;
  /**
   * A page that is BUILT but not yet PUBLISHED, and what it waits for. The plan (comparison pages):
   * "Legal review before launch." Such a page renders at its address, so it can be read and reviewed,
   * but it says `noindex`, stays out of the sitemap, and no navigation or footer links to it. Deleting
   * this one field is what publishes it.
   */
  review?: 'legal';
};

export const SITE_PAGES = {
  home: {
    path: '/',
    title: 'Zenboard: one calm workspace to run your business',
    description: 'Stop switching between five apps. Zenboard brings your tasks, projects, calendar, docs, clients and invoices into one calm workspace. Free to start.',
    crumb: 'Home',
    updated: '2026-09-28',
  },
  waitlist: {
    path: '/waitlist',
    title: 'Join the Zenboard waitlist',
    description: 'Zenboard is opening a few people at a time. Join the waitlist, get a numbered ticket, and we will email you when your place comes up.',
    crumb: 'Waitlist',
    parent: '/',
    updated: '2026-09-30',
  },
  legal: {
    path: '/legal',
    title: 'Legal · Zenboard',
    description: 'The terms that govern Zenboard, how we handle your information, and the cookies we use.',
    crumb: 'Legal',
    parent: '/',
    updated: '2026-09-26',
  },
  terms: {
    path: '/legal/terms',
    title: 'Terms of service · Zenboard',
    description: 'The agreement between you and Zenboard when you use the Zenboard website and app.',
    crumb: 'Terms of service',
    parent: '/legal',
    updated: '2026-09-26',
  },
  privacy: {
    path: '/legal/privacy-notice',
    title: 'Privacy notice · Zenboard',
    description: 'What information Zenboard collects, why, who it is shared with, how long it is kept, and your rights.',
    crumb: 'Privacy notice',
    parent: '/legal',
    updated: '2026-09-26',
  },
  cookies: {
    path: '/legal/cookie-notice',
    title: 'Cookie notice · Zenboard',
    description: 'The cookies and similar technologies Zenboard uses, what they are for, and how to change your choice.',
    crumb: 'Cookie notice',
    parent: '/legal',
    updated: '2026-09-26',
  },

  // ── PRODUCT: what Zenboard does, one page per job ─────────────────────────
  product: {
    path: '/product',
    title: 'Zenboard features: one workspace to run your business',
    description: 'Everything Zenboard does, grouped by the jobs you do: plan the day, run projects, keep clients close and get paid. Free to start.',
    crumb: 'Product',
    parent: '/',
    updated: '2026-09-29',
  },
  clientPortal: {
    path: '/product/client-portal',
    title: 'Client portal for freelancers and studios · Zenboard',
    description: 'Give each client one page to follow progress, approve work, send requests and see invoices, with no account to create. Free to start.',
    crumb: 'Client portal',
    parent: '/product',
    updated: '2026-09-29',
  },
  calendar: {
    path: '/product/calendar',
    title: 'Task manager with Google Calendar sync · Zenboard',
    description: 'Plan your day around your meetings: tasks and Google Calendar in one view, synced both ways, with a feed Outlook and Apple Calendar can follow.',
    crumb: 'Calendar',
    parent: '/product',
    updated: '2026-09-29',
  },
  invoicing: {
    path: '/product/invoicing',
    title: 'Time tracking and invoicing for freelancers · Zenboard',
    description: 'Track time on your tasks, turn it into invoice lines in one step, record payments as they arrive, and export it all for your accountant.',
    crumb: 'Invoicing',
    parent: '/product',
    updated: '2026-09-29',
  },
  projects: {
    path: '/product/projects',
    title: 'Project management for client work · Zenboard',
    description: 'Lists and boards grouped by workstream, with milestones, dependencies and briefs, and every project carrying its client and its next move.',
    crumb: 'Projects',
    parent: '/product',
    updated: '2026-09-29',
  },
  docs: {
    path: '/product/docs',
    title: 'Docs and databases linked to your work · Zenboard',
    description: 'Write briefs and notes in a block editor, keep tables and boards beside them, and link them to the tasks and projects they are about.',
    crumb: 'Docs',
    parent: '/product',
    updated: '2026-09-29',
  },

  // ── WHO IT'S FOR: only the audiences the product serves today (the plan's table) ──
  audiences: {
    path: '/for',
    title: 'Who Zenboard is for: freelancers, studios, founders',
    description: 'Zenboard is for people who run a business and do the work themselves: freelancers, consultants, small studios, founders and creators.',
    crumb: 'Who it’s for',
    parent: '/',
    updated: '2026-09-29',
  },
  freelancers: {
    path: '/for/freelancers',
    title: 'Project management app for freelancers · Zenboard',
    description: 'Plan your day, give every client a page to follow the work, and turn tracked time into invoices, in one calm workspace built for freelancers.',
    crumb: 'Freelancers',
    parent: '/for',
    updated: '2026-09-29',
  },
  consultants: {
    path: '/for/consultants',
    title: 'A workspace for independent consultants · Zenboard',
    description: 'Keep every engagement, its documents, its client and its invoices in one place, with a portal your client can follow without an account.',
    crumb: 'Consultants',
    parent: '/for',
    updated: '2026-09-29',
  },
  agencies: {
    path: '/for/agencies',
    title: 'Project management for small agencies · Zenboard',
    description: 'For the person running a small studio: client projects, a portal per client, approvals on the record and invoices from tracked time.',
    crumb: 'Agencies',
    parent: '/for',
    updated: '2026-09-29',
  },
  smallBusinesses: {
    path: '/for/small-businesses',
    title: 'One app to run your small business · Zenboard',
    description: 'For the owner who runs the business and does the work: your day, your clients and your money in one calm place, instead of five apps.',
    crumb: 'Small businesses',
    parent: '/for',
    updated: '2026-09-29',
  },

  // ── COMPARE: honest and sourced, and published only after legal review ─────
  compare: {
    path: '/compare',
    title: 'Compare Zenboard with the tools you use now',
    description: 'Honest comparisons between Zenboard and the tools people switch from, with sourced claims and when the other tool is the better choice.',
    crumb: 'Compare',
    parent: '/',
    updated: '2026-09-29',
    review: 'legal',
  },
  vsNotion: {
    path: '/compare/zenboard-vs-notion',
    title: 'Zenboard vs Notion: which fits running your business?',
    description: 'An honest comparison of Zenboard and Notion for people who run a business alone or with a small studio, with sources and when to choose Notion.',
    crumb: 'Zenboard vs Notion',
    parent: '/compare',
    updated: '2026-09-29',
    review: 'legal',
  },
  alternatives: {
    path: '/alternatives',
    title: 'Alternatives to the tools you use now · Zenboard',
    description: 'Leaving Notion or another tool? What Zenboard does instead, what it does not do, and how to bring your work across, said plainly.',
    crumb: 'Alternatives',
    parent: '/',
    updated: '2026-09-29',
    review: 'legal',
  },
  notionAlternative: {
    path: '/alternatives/notion',
    title: 'A Notion alternative for running your business · Zenboard',
    description: 'Looking for a Notion alternative? Zenboard gives you tasks, docs, clients and invoices without building the system yourself. Import your pages.',
    crumb: 'Notion alternative',
    parent: '/alternatives',
    updated: '2026-09-29',
    review: 'legal',
  },
} as const satisfies Record<string, SitePage>;

export type SitePageKey = keyof typeof SITE_PAGES;

/** Every page the website renders, published or waiting for review: what the site's own frame, its
 *  light-only appearance and its breadcrumbs cover. */
export const ALL_SITE_PAGES: readonly SitePage[] = Object.values(SITE_PAGES);

/** Is the page published? A page waiting for review renders, but search and the navigation leave it be. */
export const isLive = (page: SitePage) => !page.review;

/** Every PUBLISHED page, in the order the sitemap lists them. */
export const LIVE_SITE_PAGES: readonly SitePage[] = ALL_SITE_PAGES.filter(isLive);

/** An address on the site, absolute, spelled exactly as the page's canonical tag spells it (the
    homepage without a trailing slash), so the sitemap, the structured data and the page agree. */
export function siteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * A page's metadata, whole: title, description, canonical address, social card. Every marketing page
 * exports `metadata = pageMetadata(SITE_PAGES.<key>)` and writes none of this by hand, so no page can
 * drift from the list above.
 */
export function pageMetadata(page: SitePage): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: page.title },
    description: page.description,
    // Built, not yet published: readable at its address for the review, invisible to search.
    ...(isLive(page) ? {} : { robots: { index: false, follow: true } }),
    alternates: { canonical: page.path },
    openGraph: {
      type: 'website',
      siteName: 'Zenboard',
      locale: 'en_US',
      url: page.path,
      title: page.title,
      description: page.description,
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [SOCIAL_IMAGE.url] },
  };
}

/** A page's trail from the homepage down to it, for its breadcrumb (structured data and, later, on screen). */
export function trailTo(page: SitePage): SitePage[] {
  const trail: SitePage[] = [page];
  let at: SitePage | undefined = page;
  while (at?.parent) {
    const up = ALL_SITE_PAGES.find((p) => p.path === at?.parent);
    if (!up) break;
    trail.unshift(up);
    at = up;
  }
  return trail;
}

/**
 * THE APP, KEPT OUT OF SEARCH. Every signed-in place (each is a folder under `app/(app)`, and the
 * test holds this list to that folder) redirects a crawler to sign-in, so crawling it only wastes the
 * site's crawl on redirects. Client portals and public forms are deliberately NOT here: their links
 * are private, and a crawler has to be allowed to fetch one to see its `noindex`; a blocked URL can
 * still be listed from a link elsewhere, with no content, which is exactly the leak to avoid.
 */
export const APP_PATHS = [
  '/automations', '/calendar', '/clients', '/content', '/design', '/documents', '/focus', '/forms',
  '/habits', '/horizon', '/inbox', '/library', '/memory', '/messages', '/money', '/projects', '/rituals',
  '/settings', '/tasks', '/today', '/week',
] as const;

/** Not pages at all, or not for search: the API, the build's harnesses, sign-in plumbing, onboarding,
 *  and the platform's own admin. `/admin` carries `noindex` on the page itself as well — robots.txt
 *  asks a crawler not to FETCH, which is not the same as asking it not to LIST, and a disallowed URL
 *  can still be indexed bare from an outside link. Both, because it is a list of people's addresses. */
export const NON_PAGE_PATHS = ['/api/', '/dev-preview/', '/auth/', '/onboarding', '/overlay', '/admin'] as const;
