import type { MetadataRoute } from 'next';
import { APP_PATHS, NON_PAGE_PATHS, SITE_URL } from '@/lib/site-pages';

// The website is open to search; the app and its plumbing are not (lib/site-pages.ts says why each
// is here, and why client portals and forms are kept out by `noindex` rather than by this file).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...APP_PATHS, ...NON_PAGE_PATHS] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
