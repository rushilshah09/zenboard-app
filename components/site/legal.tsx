// ── THE LEGAL PAGES' SHAPE ──────────────────────────────────────────────────
//
// /legal and the documents under it are the website's pages like any other: the same navigation,
// the same grid with its lines running on, the same footer and cookie choice. A document is a
// header cell and a body cell; on a wide screen a contents list stands beside the body and stays in
// view while it is read. The words are the product's plain voice, and every fact about the company
// comes from lib/legal.ts, so no two pages can disagree about it.

import Link from 'next/link';
import * as React from 'react';
import { Scroll } from '@/components/ds/icons';
import { cn } from '@/lib/cn';
import { LEGAL } from '@/lib/legal';
import { siteLoaderScript } from '@/lib/site-loader';
import { CookieConsent } from './cookie-consent';
import { SiteFooter, SiteNav } from './site-chrome';
import { MEASURE } from './measure';
import { SiteLoader } from './site-loader';
import { Cell, Eyebrow, Grid, Row } from './visual';

export type Toc = { id: string; title: string }[];

/** The page every legal document lives on. */
export function LegalShell({ title, lede, toc, children }: { title: string; lede?: React.ReactNode; toc?: Toc; children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-background">
      {/* Decided before anything below it paints: plays the loader on an open, at most every 4 hours. */}
      <script dangerouslySetInnerHTML={{ __html: siteLoaderScript }} />
      <SiteLoader />
      <div aria-hidden className="site-guides"><div className={cn(MEASURE, 'h-full')}><div className="h-full border-x border-line" /></div></div>
      <SiteNav />
      <main className={MEASURE}>
        <Grid>
          <Row aria-labelledby="legal-title">
            <Cell pad className="py-14 sm:py-16 lg:py-20">
              <Eyebrow hue="periwinkle" icon={Scroll}>Legal</Eyebrow>
              <h1 id="legal-title" className="mt-6 max-w-[20ch] text-balance font-editorial text-h1 text-ink-900 sm:text-headline">{title}</h1>
              {lede && <div className="mt-5 max-w-[60ch] text-body-lg text-ink-600">{lede}</div>}
            </Cell>
          </Row>
          <Row>
            {toc && (
              <Cell pad className="py-10 max-lg:hidden lg:col-span-4 lg:py-14">
                <nav aria-label="On this page" className="sticky top-24">
                  <p className="text-ui font-medium text-ink-500">On this page</p>
                  <ol className="mt-3 flex flex-col">
                    {toc.map((t) => (
                      <li key={t.id}>
                        <a href={`#${t.id}`} className="focus-ring block rounded-md px-2 py-1.5 text-ui text-ink-700 transition-colors duration-fast ease-hover hover:bg-surface-hover hover:text-ink-900">
                          {t.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </Cell>
            )}
            <Cell pad className={cn('py-10 lg:py-14', toc ? 'lg:col-span-8' : '')}>{children}</Cell>
          </Row>
        </Grid>
      </main>
      <SiteFooter />
      <CookieConsent />
    </div>
  );
}

/** When the document took effect: said once, at the top of its body. */
export function Effective() {
  return <p className="mb-8 text-ui text-ink-500">Effective {LEGAL.effective}</p>;
}

/** One numbered part of a document. */
export function Part({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line-soft py-8 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 id={`${id}-title`} className="font-editorial text-title-2 text-ink-900">{title}</h2>
      <div className="mt-4 flex max-w-[68ch] flex-col gap-4 text-body-lg leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

export function Items({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-ink-500">{children}</ul>;
}

/** A term in bold at the start of an item, and what it means. */
export function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return <li><span className="font-medium text-ink-900">{name}.</span> {children}</li>;
}

/** An address a reader can write to: the privacy contact. */
export function ContactEmail() {
  const email = LEGAL.contactEmail;
  return /@/.test(email)
    ? <a href={`mailto:${email}`} className="focus-ring rounded-xs text-ink-900 underline underline-offset-2">{email}</a>
    : <span className="text-ink-900">{email}</span>;
}

export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="focus-ring rounded-xs text-ink-900 underline underline-offset-2">{children}</Link>;
}
