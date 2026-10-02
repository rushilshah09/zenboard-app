// ── /waitlist ───────────────────────────────────────────────────────────────
//
// The page every "Join the waitlist" leads to. It says the same thing the home page's section says,
// at an address that can be linked, shared and indexed on its own — which matters because a shared
// ticket points here (lib/waitlist.ts `shareUrl`), and LinkedIn reads this page's metadata for the
// card on that post.
//
// No metadata is written here: it comes from the one page list, like every other page.

import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { WaitlistSection } from '@/components/site/waitlist/waitlist-section';
import { SITE_PAGES, pageMetadata, trailTo } from '@/lib/site-pages';
import { breadcrumbs, organization, website } from '@/lib/structured-data';

export const metadata: Metadata = pageMetadata(SITE_PAGES.waitlist);

export default function Page() {
  return (
    <SiteShell jsonLd={[organization(), website(), breadcrumbs(trailTo(SITE_PAGES.waitlist))]}>
      <WaitlistSection source="waitlist" />
    </SiteShell>
  );
}
