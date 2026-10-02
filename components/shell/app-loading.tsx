// The fallback for the one Suspense boundary that wraps every /(app) page.
//
// Before it existed there were NO Suspense boundaries anywhere in the app, which
// meant a navigation had nothing to show while the server worked: click "Tasks"
// and the Home screen just sat there, frozen and still looking clicked, until
// every query came back. That dead interval — not the rendering — is what made
// the app feel slow next to Linear and Notion, both of which paint the new
// screen's shape immediately and fill it in.
//
// It is the default export of app/(app)/loading.tsx, so Next shows it for the
// whole group — and because that file is in every (app) route's module graph, one
// bad import here breaks the build for all of them. It did: importing the DS
// barrel took down /design, /automations and /library with "createContext is not
// a function" before the direct import below fixed it.
//
// It sits inside the layout, so the sidebar and top bar stay put and only the
// content area swaps. That is the point: the chrome should never blink.
//
// Deliberately generic and quiet — a header row and a few list rows, which is the
// shape most pages here take. A skeleton that guesses at each page's exact layout
// would be wrong more often than right, and a wrong guess reads worse than a
// plain one because the content visibly jumps when it lands.
// Imported from the module, NOT from '@/components/ds/ui'. That barrel re-exports
// 63 things, several of which (field.tsx, toggle-group.tsx) call `createContext`
// at module scope — so pulling the barrel into a SERVER component evaluates them
// in the RSC layer, where `createContext` does not exist, and the build dies with
// "(0 , e.createContext) is not a function" on whichever page it reaches first.
// `skeleton.tsx` and `view-container.tsx` are plain presentational modules with no
// 'use client' and no hooks, so they are safe to render on the server.
import { Skeleton } from '@/components/ds/ui/skeleton';
import { ViewContainer } from '@/components/ui/view-container';

export function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* The page header row, at its real height so nothing shifts on arrival. */}
      <div
        className="flex items-center border-b border-line-soft"
        style={{ minHeight: 'var(--page-header-h, 48px)', paddingInline: 'var(--app-header-px, 12px)' }}
      >
        <Skeleton shape="line" className="w-40" />
        <span className="flex-1" />
        <Skeleton shape="line" className="w-20" />
      </div>

      {/* The page rhythm, from the same tokens <PageLayout> uses. A skeleton at a
          different inset is a skeleton that makes the content jump when it
          arrives — the exact failure the note at the top of this file warns
          about. (Not <PageLayout> itself: this renders on the SERVER, and the
          layout is a client component.) */}
      <ViewContainer className="page-rhythm">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton shape="block" className="size-4 shrink-0 rounded-xs" />
              {/* Widths vary so it reads as a list of real things, not a barcode. */}
              <Skeleton shape="line" className={['w-1/2', 'w-2/3', 'w-2/5', 'w-3/5', 'w-1/3', 'w-1/2'][i]} />
            </div>
          ))}
        </div>
      </ViewContainer>
    </div>
  );
}
