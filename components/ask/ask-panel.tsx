'use client';
// ── ASK — THE SIDE PANEL ────────────────────────────────────────────────────
//
// The QUICK surface. Home's Ask mode (`components/ask/ask-home.tsx`) is the roomy one; this is the
// one you reach without going anywhere, from the A key, the top bar, or ⌘K's fall-through row. Both
// draw `components/ask/ask-conversation.tsx` against one store, so they are the same conversation.
//
// Mounted ONCE in the app shell, like the focus timer and the meeting recorder, for the reason all
// three share: it must survive a navigation.
//
// ── WHY A NON-MODAL DRAWER AND NOT A SECOND PAGE ────────────────────────────
// USER BRIEF: *"Do not make users navigate through multiple screens for simple actions that can be
// completed through Chat."* Making you go to Home to ask would be exactly that navigation — and
// worse, it would take away the thing the sentence is about: "this task" has no referent on a page
// that is not showing the task. So the page stays visible and stays interactive
// (`modal={false}`), and the panel reads the open record straight out of the URL, which is where
// this product already keeps that answer (`recordHref` / `parseRecordHref`, lib/connected.ts).
//
// It is not a second command palette either. ⌘K stays the fast path for a command you already know
// — a list, keyboard-driven, no model, no latency — and hands over to this one, carrying your
// words, when nothing matches. Nobody has to learn which box to use.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Drawer } from '@/components/ds/ui';
import { AskComposer, AskReset, AskTranscript, sendAsk } from '@/components/ask/ask-conversation';
import type { AskRef } from '@/lib/actions/ask';
import { askExamples } from '@/lib/ask';
import { parseRecordHref } from '@/lib/connected';
import { useFocusReturn } from '@/lib/use-focus-return';

/** Anything may open Ask: the top bar, the palette's fall-through row, the keyboard. */
export const ASK_EVENT = 'zb:ask';

/** Opening with words already in hand — the palette hands over what you typed, and Ask asks it. */
export type AskOpenDetail = { message?: string };

export const openAsk = (message?: string) =>
  window.dispatchEvent(new CustomEvent<AskOpenDetail>(ASK_EVENT, { detail: { message } }));

/**
 * What "this" means, read from the URL.
 *
 * A task drawer opens OVER any page (`/projects/x?task=y`), so it is checked first: it is literally
 * the thing in front of you. Everything else goes through `parseRecordHref`, the one function that
 * knows how to read an address in this product — so Ask learns about a new record route the moment
 * that route exists, with no list of its own to fall out of date.
 *
 * Exported because Home's Ask mode wants the same answer, and there is one way to ask it.
 */
export function useAskRef(): AskRef | null {
  const pathname = usePathname();
  const params = useSearchParams();
  return React.useMemo(() => {
    const task = params.get('task');
    if (task && /^[0-9a-f-]{16,}$/i.test(task)) return { type: 'task', id: task };
    const search = params.toString();
    const parsed = parseRecordHref(`${pathname}${search ? `?${search}` : ''}`);
    return parsed ? { type: parsed.type, id: parsed.id } : null;
  }, [pathname, params]);
}

export function AskPanel() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const ref = useAskRef();

  // Escape hands focus back to whatever opened the panel. A layer that skips this leaves focus on
  // <body>, which is the bug [[zenboard-focus-return]] exists to remember.
  useFocusReturn(open);

  const settle = React.useCallback(() => { router.refresh(); }, [router]);
  const send = React.useCallback((message: string) => { void sendAsk(message, ref, settle); }, [ref, settle]);

  /**
   * The current `send`, for the open listener.
   *
   * The listener is registered once and would otherwise hold the first render's `send` forever,
   * with the first render's idea of which record is open. Parking the words in state instead would
   * mean a setState inside an effect to clear them again, which is a cascading render for
   * bookkeeping — so the words are simply asked, from the event, with the current closure.
   */
  const sendRef = React.useRef(send);
  React.useEffect(() => { sendRef.current = send; }, [send]);

  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const message = (e as CustomEvent<AskOpenDetail>).detail?.message?.trim();
      setOpen(true);
      if (message) sendRef.current(message);
    };
    window.addEventListener(ASK_EVENT, onOpen);
    return () => window.removeEventListener(ASK_EVENT, onOpen);
  }, []);

  const leave = React.useCallback(() => setOpen(false), []);

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title="Ask"
      size="md"
      modal={false}
      // Ask is asked ABOUT the page beneath it — a meeting, a task — so it must not close that page
      // when pressed, nor lose its own scrolling to that page's scroll lock (components/ds/ui/drawer.tsx).
      companion
      actions={<AskReset />}
      footer={<div className="w-full"><AskComposer bare autoFocus onSend={send} /></div>}
    >
      <AskTranscript onSend={send} onLeave={leave} examples={askExamples(ref?.type)} />
    </Drawer>
  );
}
