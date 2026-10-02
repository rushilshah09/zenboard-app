// Every (app) page renders <PageStamp/> in its output — AFTER its data has
// loaded, which is where a page's return statement already is.
//
// It stamps THIS PAGE's render so `RevalidateOnStale` can tell a page the
// server just rendered for you from one the browser served out of its Client
// Cache (see that file for the whole pattern).
//
// ── WHY PER PAGE, AND NOT IN app/(app)/template.tsx (measured 2026-09-11) ───
// The stamp used to be rendered once, in the (app) template, on the belief
// that a template re-renders per navigation. It REMOUNTS per navigation, but
// its props are part of the (app) segment's payload, and a client navigation
// between (app) pages never re-renders that segment. So after the first few
// seconds on any page, every navigation mounted the template with an old
// stamp, judged the page "cached", and called `router.refresh()`: two full
// server renders for every sidebar click, measured on a production build. A
// page's own output is re-rendered by exactly the navigations that fetch it,
// and served from the cache by exactly the ones that don't — so that is where
// the stamp tells the truth.
//
// `app/(app)/page-stamp.test.ts` fails any (app) page that forgets it.
import { RevalidateOnStale } from '@/components/shell/revalidate-on-stale';
import { serverRenderedAt } from '@/lib/render-stamp';

export function PageStamp() {
  return <RevalidateOnStale renderedAt={serverRenderedAt()} />;
}
