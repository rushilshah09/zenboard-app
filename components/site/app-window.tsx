'use client';
// ── THE APP, IN A WINDOW ────────────────────────────────────────────────────
//
// The product section (user, 2026-09-28, with Notion's home page open: "I want like Notion, a real
// dashboard application demo here, not a fake one"). Notion shows its product as an application — a
// window, its sidebar, a real page — and so does this: a window's frame, and inside it Zenboard ITSELF,
// the product's own views on a sample studio's data (/demo, components/demo). Not a drawing of the app:
// the app, walled off so that nothing a visitor does in it leaves their browser.
//
// The frame is the part that is ours: the window's controls, drawn quiet (grey, not traffic-light
// colours: this is the product's window, not a Mac), the back and forward the app does not need, and a
// tab that names the place the visitor is on, told by the demo as it moves (`view`). The demo can also
// ask for a focus session (`focus`), which the website runs itself (guest-focus.tsx), full screen.
//
// Until the demo has drawn itself it shows its own ground and two empty panels in the shell's
// proportions, so the window never flashes white and nothing jumps when the app arrives.

import * as React from 'react';
import { ChevronLeft, ChevronRight, Plus } from '@/components/ds/icons';
import { Icon, Mark, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { openGuestFocus } from '@/lib/guest-focus';

/** The demo's messages (components/demo/demo-app.tsx `DemoMessage`), checked by shape here so the
    website does not import the demo's code. */
type Message = { source?: string; type?: string; label?: string; what?: string };

export function AppWindow({ className }: { className?: string }) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [label, setLabel] = React.useState('Home');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent<Message>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data;
      if (!m || m.source !== 'zb-demo') return;
      if (m.type === 'ready') setReady(true);
      if (m.type === 'view' && typeof m.label === 'string') setLabel(m.label);
      if (m.type === 'focus') openGuestFocus(typeof m.what === 'string' ? m.what : undefined);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className={cn('site-window overflow-hidden rounded-xl', className)}>
      {/* The window's bar. Decorative: the controls in it do nothing, so they are not controls. */}
      <div aria-hidden className="flex h-10 items-center gap-3 border-b border-line bg-surface-desk px-3.5">
        <span className="flex gap-1.5">
          <span className="size-3 rounded-full bg-ink-300" />
          <span className="size-3 rounded-full bg-ink-300" />
          <span className="size-3 rounded-full bg-ink-300" />
        </span>
        <span className="ms-2 flex items-center gap-1 text-ink-500">
          <Icon icon={ChevronLeft} size={16} />
          <Icon icon={ChevronRight} size={16} />
        </span>
        <span className="flex h-7 min-w-0 items-center gap-2 rounded-md bg-surface-raised px-2.5 text-caption font-medium text-ink-800 shadow-xs">
          <Mark size={12} tone="brand" />
          <span className="truncate">{label}</span>
        </span>
        <Icon icon={Plus} size={14} className="text-ink-500" />
      </div>
      <div className="relative h-[36rem] bg-surface-desk sm:h-[42rem] lg:h-[46rem]">
        {/* The shell's shape while the app loads: the desk, the sidebar panel, the header, the page. */}
        {!ready && (
          <div aria-hidden className="absolute inset-0 flex gap-1 p-1">
            <span className={cardClass('hidden w-[230px] shrink-0 md:block')} />
            <span className="flex flex-1 flex-col gap-1">
              <span className={cardClass('h-11')} />
              <span className={cardClass('flex-1')} />
            </span>
          </div>
        )}
        <iframe
          ref={frame}
          src="/demo"
          title="Zenboard, working, on a sample studio’s day. Nothing you do here is saved."
          loading="lazy"
          className={cn('absolute inset-0 size-full transition-opacity duration-slow ease-hover', ready ? 'opacity-100' : 'opacity-0')}
        />
      </div>
    </div>
  );
}
