import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SiteHome } from '@/components/site/site-home';
import { pageMetadata, SITE_PAGES } from '@/lib/site-pages';

// The root is the website — for everyone who is not signed in. Someone WITH a session came to open
// the app, not to read about it, so they go straight to Home as they always have. Only the cookie's
// presence is read (no database round trip): a stale one lands on /today, whose own gate sends it
// to /login, which is exactly where it would have gone before.

export const metadata: Metadata = pageMetadata(SITE_PAGES.home);

export default async function Home() {
  const jar = await cookies();
  if (jar.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))) redirect('/today');
  return <SiteHome />;
}
