// ── WHAT SEARCH ENGINES READ ABOUT THE SITE (schema.org, JSON-LD) ───────────
//
// The plan: Organization, WebSite and SoftwareApplication on the homepage, FAQPage from the real
// questions, BreadcrumbList on inner pages. Every value is one the site already states in words a
// visitor can read, because structured data that says more than the page is what search engines
// penalise, and because it is a claim like any other: the offer is free because the terms say
// "free to use today" (app/legal/terms), and nothing here names a rating, a review or a price
// the site does not show.

import { siteUrl, SITE_URL, type SitePage } from './site-pages';

type Json = Record<string, unknown>;

export function organization(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Zenboard',
    url: siteUrl('/'),
    logo: `${SITE_URL}/icon.svg`,
  };
}

export function website(): Json {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Zenboard', url: siteUrl('/') };
}

export function softwareApplication(description: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zenboard',
    url: siteUrl('/'),
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    // "Zenboard is free to use today" (the terms of service, "Price").
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export function faqPage(items: readonly { q: string; a: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function breadcrumbs(trail: readonly SitePage[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.crumb, item: siteUrl(p.path) })),
  };
}

/**
 * The script body, safe inside `<script>`: JSON.stringify leaves `<` alone, so a value containing
 * `</script>` would end the tag early and whatever followed would run as markup. Escaped as `<`,
 * which a JSON parser reads back as `<`.
 */
export function jsonLdText(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
