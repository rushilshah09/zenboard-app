'use client';
// ── ZENBOARD, WITH A SAMPLE STUDIO'S DAY ────────────────────────────────────
//
// The product demo on the home page (user, 2026-09-28, pointing at Notion's: "I want like Notion, a real
// dashboard application demo here, not a fake one"). What stood there before was a drawing of the app
// made of design-system parts; it had drifted from the product (another sidebar, a rail the app does not
// have, no header panel), which is exactly how a demo reads as fake. This one is the app: the shell's
// frame (demo-shell.tsx, held to the real one by a test) around the product's own views, fed a sample
// studio's data (fixtures.ts) in the types their loaders produce.
//
// It runs inside an iframe at /demo, walled off by the sandbox (sandbox.ts): its server actions are
// answered locally, no request leaves, and its storage is its own, so a visitor can tick, type and click
// through everything and nothing reaches any account. Navigation stays inside it (demo-router.tsx).
//
// It tells the page around it what it is showing (`view`, for the window's tab) and asks it to open a
// focus session when the visitor asks for one (`focus`): focus without an account is the website's own
// (guest-focus.tsx), so the demo hands it to the page rather than drawing a second one.

import * as React from 'react';
import { toast } from '@/components/ds/ui';
import type { Pin } from '@/lib/pins';
import { DemoRouter } from './demo-router';
import { ALL_NAV, DemoShell } from './demo-shell';
import { PERSON } from './fixtures';
import { installSandbox, isSandboxed } from './sandbox';

// Again, and before anything renders: idempotent, and it means this module is safe even if something
// ever imports it without going through the entry.
installSandbox();

/** The message every exchange with the page carries, so the page can tell ours from anything else. */
export const DEMO_MESSAGE = 'zb-demo';
export type DemoMessage =
  | { source: typeof DEMO_MESSAGE; type: 'ready' }
  | { source: typeof DEMO_MESSAGE; type: 'view'; label: string }
  | { source: typeof DEMO_MESSAGE; type: 'focus'; what?: string };

/** A message without its `source`, which `post` adds (distributed over the union, so each keeps its own fields). */
type Payload = DemoMessage extends infer M ? (M extends unknown ? Omit<M, 'source'> : never) : never;

function post(message: Payload) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ source: DEMO_MESSAGE, ...message }, window.location.origin);
}

const BASE = 'https://demo.invalid';
const PINS: Pin[] = [
  { type: 'project', id: 'p-ridgeline', label: 'Ridgeline rebrand' },
  { type: 'doc', id: 'd-brief', label: 'Ridgeline, brand brief' },
  { type: 'invoice', id: 'in-021', label: 'INV-021 · Ridgeline' },
];

/** Every place in the sidebar, as the product's own view on the studio's data (views/). Each loads the
 *  first time it is opened, so the window's first paint carries Home and nothing else. */
const VIEWS: Record<string, React.LazyExoticComponent<() => React.ReactElement>> = {
  today: React.lazy(() => import('./views/home')),
  tasks: React.lazy(() => import('./views/tasks')),
  calendar: React.lazy(() => import('./views/calendar')),
  projects: React.lazy(() => import('./views/projects')),
  clients: React.lazy(() => import('./views/clients')),
  messages: React.lazy(() => import('./views/messages')),
  forms: React.lazy(() => import('./views/forms')),
  content: React.lazy(() => import('./views/content')),
  documents: React.lazy(() => import('./views/documents')),
  money: React.lazy(() => import('./views/money')),
  invoice: React.lazy(() => import('./views/invoice')),
  horizon: React.lazy(() => import('./views/goals')),
  habits: React.lazy(() => import('./views/habits')),
};

const viewOf = (pathname: string) => ALL_NAV.find((m) => pathname.startsWith(m.href))?.id ?? null;

export function DemoApp() {
  // NEVER UNSEALED. If the sandbox is not in place, the product's views do not render at all.
  if (!isSandboxed()) return null;
  return <SealedDemo />;
}

function SealedDemo() {
  const [href, setHref] = React.useState('/today');
  const url = new URL(href, BASE);
  const current = viewOf(url.pathname) ?? 'today';
  // A record opened by its address (`/projects/<id>`, `/money/<id>`, `/documents?page=<id>`) is a
  // route of its own in the app, so here it is a fresh view keyed by that record. An invoice is its own
  // page under Finance, which stays lit in the sidebar.
  const record = url.pathname.split('/')[2] ?? url.searchParams.get('page') ?? '';
  const View = current === 'money' && record ? VIEWS.invoice : VIEWS[current] ?? VIEWS.today;

  const navigate = React.useCallback((to: string) => {
    const url = new URL(to, BASE);
    if (url.origin !== BASE) return;
    if (url.pathname.startsWith('/focus')) {
      post({ type: 'focus' });
      return;
    }
    const id = viewOf(url.pathname);
    if (!id || !VIEWS[id]) {
      toast({ message: 'That part of Zenboard opens in the app, not in this demo.' });
      return;
    }
    setHref(url.pathname + url.search);
  }, []);

  // The page's tab follows the view.
  React.useEffect(() => {
    post({ type: 'view', label: ALL_NAV.find((m) => m.id === current)?.label ?? 'Zenboard' });
  }, [current]);
  React.useEffect(() => { post({ type: 'ready' }); }, []);

  // The demo wears the website's one appearance (lib/theme.ts `SITE_APPEARANCE`): /demo is one of the
  // site's own addresses, so the boot script and every later apply resolve it, whatever is stored.

  return (
    <DemoRouter href={href} onNavigate={navigate}>
      <DemoShell current={current} pins={PINS} workspace={PERSON.studio} onNavigate={navigate} onFocus={() => post({ type: 'focus' })}>
        {/* Keyed by the view, so a place always opens fresh at its own top, the way a route does. */}
        <React.Suspense fallback={null}>
          <View key={`${current}|${record}`} />
        </React.Suspense>
      </DemoShell>
    </DemoRouter>
  );
}
