'use client';
// ── THE DEMO'S ROUTER: NAVIGATION THAT NEVER LEAVES THE PAGE ────────────────
//
// The product's views navigate the way any Next page does: `useRouter().push('/projects/p1')`, a
// `<Link href="/documents">`, `usePathname()` to know where they are. In the demo those must move
// between the demo's own views and never load an app route — which would ask a signed-out visitor to
// log in, and a signed-in one would be shown their real account inside the website.
//
// So the views are given a router of our own through the same contexts Next's hooks read
// (next/dist/client/components/navigation.js): `useRouter` gets one whose push and replace hand the
// address to the demo, `usePathname` and `useSearchParams` get the view's own address, and refresh and
// prefetch do nothing. A `<Link>` does not go through `useRouter` (it dispatches navigation itself), but
// it stands down on a click that is already cancelled, so the shell cancels every link click in
// capture phase and hands the address to the same place (demo-shell.tsx). `NavigationPromisesContext`
// is cleared because in development the hooks read it first, and it holds the real page's address.

import * as React from 'react';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  NavigationPromisesContext, PathParamsContext, PathnameContext, SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

const NO_PARAMS = {};

export function DemoRouter({ href, onNavigate, children }: {
  /** Where the view believes it is, e.g. `/today` or `/projects?p=p-ridgeline`. */
  href: string;
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}) {
  const url = React.useMemo(() => new URL(href, 'https://demo.invalid'), [href]);
  const search = React.useMemo(() => new URLSearchParams(url.search), [url]);
  const router = React.useMemo<AppRouterInstance>(() => ({
    back() {},
    forward() {},
    refresh() {},
    prefetch() {},
    push: (to) => onNavigate(to),
    replace: (to) => onNavigate(to),
  }), [onNavigate]);
  return (
    <AppRouterContext.Provider value={router}>
      <NavigationPromisesContext.Provider value={null}>
        <PathnameContext.Provider value={url.pathname}>
          <SearchParamsContext.Provider value={search}>
            <PathParamsContext.Provider value={NO_PARAMS}>{children}</PathParamsContext.Provider>
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </NavigationPromisesContext.Provider>
    </AppRouterContext.Provider>
  );
}
