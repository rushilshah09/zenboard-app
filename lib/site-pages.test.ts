import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { FAQ } from '@/components/site/faq-data';
import { ALL_SITE_PAGES, APP_PATHS, isLive, LIVE_SITE_PAGES, NON_PAGE_PATHS, pageMetadata, SITE_PAGES, SITE_URL, siteUrl, trailTo } from './site-pages';
import { breadcrumbs, faqPage, jsonLdText, softwareApplication } from './structured-data';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

// The website and SEO plan (2026-09-27): search is part of the architecture. These hold the rules
// that make a page findable the day it ships, so no page can arrive without them.
describe('every public page is in one list, and search reads it from there', () => {
  it('gives every page a search title and a search line that fit the result', () => {
    for (const p of ALL_SITE_PAGES) {
      expect(p.title.length, `${p.path}: "${p.title}"`).toBeLessThanOrEqual(60);
      expect(p.title.length, p.path).toBeGreaterThanOrEqual(12);
      expect(p.description.length, `${p.path}: ${p.description.length} characters`).toBeLessThanOrEqual(155);
      expect(p.description.length, p.path).toBeGreaterThanOrEqual(70);
      expect(p.title, `${p.path}: every title names the product`).toMatch(/Zenboard/);
    }
    // Two pages chasing the same words split each other's rank.
    expect(new Set(ALL_SITE_PAGES.map((p) => p.title)).size).toBe(ALL_SITE_PAGES.length);
    expect(new Set(ALL_SITE_PAGES.map((p) => p.description)).size).toBe(ALL_SITE_PAGES.length);
  });

  it('keeps every address clean: lowercase, hyphenated, no trailing slash, no dates', () => {
    const paths = ALL_SITE_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path, path).toMatch(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/);
      expect(path, `${path} carries a date`).not.toMatch(/\d{4}/);
    }
  });

  it('dates what each page says, and never in the future', () => {
    for (const p of ALL_SITE_PAGES) {
      expect(p.updated, p.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(p.updated)), p.path).toBe(false);
      expect(Date.parse(p.updated), `${p.path} is dated after today`).toBeLessThanOrEqual(Date.now() + 864e5);
    }
  });

  it('gives each page its own canonical address and a social card, from the one helper', () => {
    const m = pageMetadata(SITE_PAGES.terms);
    expect(m.alternates?.canonical).toBe('/legal/terms');
    expect(String(m.metadataBase)).toBe(`${SITE_URL}/`);
    expect(m.openGraph?.images).toBeTruthy();
    expect(read('public/og/zenboard.png').length, 'the social card exists').toBeGreaterThan(1000);
    // No page writes its own metadata: each takes it from the list, so none can drift from it.
    expect(read('app/page.tsx')).toMatch(/export const metadata: Metadata = pageMetadata\(SITE_PAGES\.home\);/);
    for (const [file, key] of [['app/legal/page.tsx', 'legal'], ['app/legal/terms/page.tsx', 'terms'], ['app/legal/privacy-notice/page.tsx', 'privacy'], ['app/legal/cookie-notice/page.tsx', 'cookies']]) {
      expect(read(file), file).toMatch(new RegExp(`pageMetadata\\(SITE_PAGES\\.${key}\\)`));
      expect(read(file), `${file} states its breadcrumb`).toMatch(new RegExp(`<LegalShell page=\\{SITE_PAGES\\.${key}\\}`));
    }
  });

  it('lists exactly the PUBLISHED pages in the sitemap, spelled as their canonical addresses', () => {
    const urls = sitemap().map((e) => e.url);
    // The sitemap lists what is PUBLISHED, not everything the site renders: app/sitemap.ts maps
    // LIVE_SITE_PAGES. A page carrying `review` is built and readable at its address so it CAN be
    // reviewed, and kept out of search until it is — the comparison and alternatives pages name a
    // competitor and wait on legal. Asserting ALL_SITE_PAGES here contradicted the gate the list
    // itself declares, so it failed the moment those four pages were written.
    expect(urls.sort()).toEqual(LIVE_SITE_PAGES.map((p) => siteUrl(p.path)).sort());
    const waiting = ALL_SITE_PAGES.filter((p) => !isLive(p));
    expect(waiting.length, 'some page is waiting on review — else this gate is untested').toBeGreaterThan(0);
    for (const p of waiting) {
      expect(urls, `${p.path} waits on review, so the sitemap never offers it`).not.toContain(siteUrl(p.path));
      expect(pageMetadata(p).robots, `${p.path} says noindex while it waits`).toMatchObject({ index: false });
    }
    expect(siteUrl('/'), 'the homepage has no trailing slash, like its canonical tag').toBe(SITE_URL);
    for (const u of urls) expect(u.startsWith(SITE_URL), u).toBe(true);
  });
});

describe('the app stays out of search, and private links stay unindexed', () => {
  const rules = robots();
  const disallowed = ([] as string[]).concat(...[rules.rules].flat().map((r) => [r.disallow ?? []].flat()));

  it('keeps every signed-in place out, and the list cannot fall behind the app', () => {
    const appDir = join(__dirname, '..', 'app', '(app)');
    const places = readdirSync(appDir).filter((d) => statSync(join(appDir, d)).isDirectory());
    for (const d of places) expect(APP_PATHS, `app/(app)/${d} is not kept out of search`).toContain(`/${d}` as (typeof APP_PATHS)[number]);
    for (const p of [...APP_PATHS, ...NON_PAGE_PATHS]) expect(disallowed).toContain(p);
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it('never blocks a page of the website by accident (robots rules match by prefix)', () => {
    for (const page of ALL_SITE_PAGES) {
      for (const rule of disallowed) expect(page.path.startsWith(rule), `${rule} would hide ${page.path}`).toBe(false);
    }
  });

  it('leaves client portals and forms crawlable so their noindex is seen, and they carry it', () => {
    expect(disallowed.some((d) => d.startsWith('/portal') || d.startsWith('/f/'))).toBe(false);
    expect(read('app/portal/[token]/page.tsx')).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(read('app/f/[token]/page.tsx')).toMatch(/robots: \{ index: false, follow: false \}/);
  });
});

describe('structured data says only what the page says', () => {
  it('states the homepage, the app with its free offer, and the questions shown', () => {
    const home = read('components/site/site-home.tsx');
    // The page STATES its structured data and the frame renders it: site-shell.tsx takes `jsonLd` and
    // holds the site's only <JsonLd>, so no page can print the tag twice or leave it out.
    expect(home).toMatch(/<SiteShell jsonLd=\{\[organization\(\), website\(\), softwareApplication\(APP_LINE\), faqPage\(FAQ\)\]\}>/);
    expect(read('components/site/site-shell.tsx')).toMatch(/\{jsonLd && <JsonLd data=\{jsonLd\} \/>\}/);
    // Free because the terms say so, word for word.
    expect(read('app/legal/terms/page.tsx')).toMatch(/is free to use today/);
    expect(softwareApplication('x').offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
    // The questions in the structured data are the ones on screen: one list feeds both.
    expect(read('components/site/site-chrome.tsx')).toMatch(/import \{ FAQ \} from '\.\/faq-data';/);
    const faq = faqPage(FAQ) as { mainEntity: { name: string }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(FAQ.map((f) => f.q));
  });

  it('draws the breadcrumb from the list: Home, then each page above, then the page', () => {
    const trail = trailTo(SITE_PAGES.terms).map((p) => p.crumb);
    expect(trail).toEqual(['Home', 'Legal', 'Terms of service']);
    const list = breadcrumbs(trailTo(SITE_PAGES.terms)) as { itemListElement: { position: number; item: string }[] };
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement.at(-1)?.item).toBe(siteUrl('/legal/terms'));
  });

  it('cannot be closed early by a value that contains a closing script tag', () => {
    const text = jsonLdText({ name: 'a </script><script>alert(1)</script>' });
    expect(text).not.toMatch(/<\/script>/i);
    expect(JSON.parse(text).name).toBe('a </script><script>alert(1)</script>');
  });
});
