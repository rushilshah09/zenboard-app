import type { MetadataRoute } from 'next';
import { LIVE_SITE_PAGES, siteUrl } from '@/lib/site-pages';

// Every PUBLISHED page, from the one list (lib/site-pages.ts): a page is in the sitemap because it is in
// the list, never because someone remembered to add it here. A page waiting for review is not.
export default function sitemap(): MetadataRoute.Sitemap {
  return LIVE_SITE_PAGES.map((p) => ({
    url: siteUrl(p.path),
    lastModified: p.updated,
    changeFrequency: p.path === '/' ? 'weekly' : 'monthly',
    priority: p.path === '/' ? 1 : p.path.startsWith('/legal') ? 0.3 : 0.8,
  }));
}
