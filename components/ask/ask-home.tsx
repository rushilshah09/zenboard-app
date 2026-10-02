'use client';
// ── ASK ON HOME — THE ROOMY SURFACE ─────────────────────────────────────────
//
// USER DIRECTION 2026-09-29, with a wireframe: Home carries a toggle, and its second position is
// the conversation — one wide box in the middle of the page asking what you need, the dashboard
// put away behind it.
//
// It is the SAME conversation as the side panel, off the same store: ask something in the panel,
// switch Home to Ask, and your history is there. Two surfaces, one product
// (`components/ask/ask-conversation.tsx`, `lib/ask-store.ts`).
//
// ── WHAT THE FIRST PASS GOT WRONG (user: "this design looks basic") ─────────
// It shipped the DRAWER'S composer on a whole page: one hairline line, 32px tall, floating in the
// middle of nothing. Three faults, and none of them were about taste:
//
//  1. **A field inside a card is two boxes.** A bordered textarea in a bordered wrapper is the
//     double-border fault the design audit already named. The composer is now the SURFACE — it
//     carries the border, the elevation and the focus ring, and the field inside it is chromeless
//     (`MessageComposer size="roomy"`, the DS Textarea's declared `chromeless` tier).
//  2. **The primary act of a screen needs presence.** At one line it read as a search field. It
//     opens at ~92px now, at 15px type, which is also what the wireframe drew.
//  3. **Four identical pills in a centred row read as a toolbar**, not as things you could say.
//     They are rows now: a sentence, an arrow, one per line at the width of the box above them.
//
// ── THE SHAPE, AND WHY IT CHANGES ONCE YOU SPEAK ────────────────────────────
// Empty, the composer sits high in the page rather than dead centre — the eye lands where the
// greeting left it, and a box centred in 900px of nothing is a box nobody is looking at. The
// moment there is a transcript the composer settles under it, because from then on this is a page
// you READ, and a box that moves as the conversation grows is one you have to find again after
// every answer.
//
// Its width is the MEASURE (globals.css `--measure`), not a fourth layout width: Home's `PageLayout`
// puts the page in the reading column, and inside it a conversation is set at the width prose is
// read at, so a question and its answer sit in one column instead of at the column's two edges.
//
// ── THE ENTRANCE ────────────────────────────────────────────────────────────
// Switching modes is an occasional, pointer-driven act, which is exactly where Emil's framework
// says an entrance earns its place: it prevents the jarring change of a whole page swapping under
// you. `<Appear index>` is the DS's own staggered arrival — 30ms apart, hardware-accelerated
// transform strings, and it renders STILL for reduced motion or when a key opened it, so the
// keyboard path stays instant without this file deciding that again.

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { AskComposer, AskTranscript, sendAsk } from '@/components/ask/ask-conversation';
import { useAskRef } from '@/components/ask/ask-panel';
import { ArrowUpRight } from '@/components/ds/icons';
import { Appear, Icon } from '@/components/ds/ui';
import { askExamples } from '@/lib/ask';
import { useAskState } from '@/lib/ask-store';

export function AskHome() {
  const router = useRouter();
  const ref = useAskRef();
  const { turns, busy } = useAskState();
  const settle = React.useCallback(() => { router.refresh(); }, [router]);
  const send = React.useCallback((message: string) => { void sendAsk(message, ref, settle); }, [ref, settle]);

  const empty = turns.length === 0;

  // What Ask can SEE, in the footer band where the task composer keeps "Today ⌄". This is
  // Zenboard's honest answer to the model picker in a chat app: not which model is running, but
  // which record the word "this" will mean. It names the TYPE rather than the title because the
  // title is not on the client — `lib/actions/ask.ts` reads it through the caller's own RLS, which
  // is what keeps a page's content out of a prompt unless the database put it there.
  const lead = ref ? `Looking at this ${ref.type}` : undefined;

  if (!empty) {
    return (
      // ── A CONVERSATION IS A SCROLLING TRANSCRIPT WITH A COMPOSER UNDER IT ────────────────────
      // Both references do the same thing the moment there is something to read: the answers
      // scroll and the box stays where your hands are. It used to be one column in normal flow —
      // ask three questions and the composer walked off the bottom of the page, so every reply
      // began with a scroll to find the thing you were about to type in.
      //
      // `min-h-0` is the load-bearing class and the one that is always forgotten: a flex CHILD's
      // default `min-height: auto` refuses to shrink below its content, so without it the
      // transcript grows the section instead of scrolling inside it and the composer is pushed
      // out exactly as before. `flex-1` alone does not do it.
      //
      // `scroll-region` rather than a bare `overflow-y-auto`: it is the app's one scrolling rule
      // (app/ds-theme.css) and it brings `scrollbar-gutter: stable`, so the transcript does not
      // jump sideways by a scrollbar's width the first time an answer makes it long enough.
      // ON THE MEASURE (globals.css `--measure`), centred: a question and its answer belong to one
      // column you read down, not to the two edges of the page (2026-10-02).
      <section aria-label="Ask" className="flex min-h-0 flex-1 flex-col gap-4 pt-1">
        <div className="scroll-region -mx-1 min-h-0 flex-1 px-1">
          <div className="mx-auto w-full max-w-[var(--measure)]">
            <AskTranscript onSend={send} examples={askExamples(ref?.type)} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[var(--measure)]">
          <AskComposer bare size="roomy" lead={lead} onSend={send} />
        </div>
      </section>
    );
  }

  return (
    // ── CENTRED, WITH ROOM AROUND IT (user, 2026-09-29) ───────────────────────────────────────
    // "like claude clean center of the page calm clean", with Claude Code's and Notion AI's empty
    // states beside a screenshot of this one. Both references are the same composition: a mark, a
    // line of type, one input, a quiet row under it — and all of it in the middle of the page with
    // nothing else competing. Home in Ask mode already HAS the first two (the greeting and the
    // toggle are directly above), so centring the rest completes the picture rather than copying it.
    //
    // `flex-1` inside the column `today-view.tsx` turns on for this mode: the section takes every
    // pixel the dashboard is not using and `justify-center` settles the composer in the middle of
    // it, at any window height, with no viewport arithmetic and no magic number.
    //
    // THIS REVERSES A DELIBERATE DECISION, so the reason it was made is worth keeping: "a box
    // centred in 900px of nothing is a box nobody is looking at" — the worry was that centring
    // strands the composer below the fold of attention. What the references show is that it only
    // strands it when the composer is ALONE. Under a greeting that names you and a toggle you just
    // pressed, the eye is already travelling down the middle of the page, and the box is where the
    // eye was going.
    <section aria-label="Ask" className="mx-auto flex w-full max-w-[var(--measure)] flex-1 flex-col justify-center gap-3 py-8">
      <Appear index={0}>
        <AskComposer bare autoFocus size="roomy" lead={lead} onSend={send} />
      </Appear>

      <Appear index={1}>
        <ul className="flex flex-col">
          {askExamples(ref?.type).map((example) => (
            <li key={example}>
              <button
                type="button"
                disabled={busy}
                onClick={() => send(example)}
                // A row, not a pill: full width under the box, so the four of them read as a list
                // of things you could say rather than a row of controls. `zb-press` is the app's
                // one press, so this feels like every other pressable thing in the product.
                // `px-4` is the CARD's own inset, so a suggestion's first letter sits directly
                // under the placeholder above it rather than eight pixels off it — the alignment
                // is what makes four rows read as continuations of the box. `h-8` is the menu-item
                // rung of the row scale (--row-nav), not a padding someone picked.
                //
                // NO `hover:bg-*`: `zb-press` is the app's one press and it already washes on
                // hover, on active, and only where a pointer can actually hover. A second wash on
                // top of it is a state applied twice, which `app/theme-bridge.test.ts` catches by
                // name — and it caught this line.
                className="zb-press focus-ring group flex h-8 w-full items-center gap-2 rounded-sm px-4 text-start text-ui text-ink-600 disabled:text-ink-500"
              >
                <span className="min-w-0 flex-1 truncate">{example}</span>
                {/* The arrow is the affordance, and it arrives on hover rather than sitting on
                    four rows at rest — the star/flag rule: a glyph renders when it means
                    something, and reveals on row hover otherwise. */}
                <Icon
                  icon={ArrowUpRight}
                  size={14}
                  className="shrink-0 text-ink-500 opacity-0 transition-opacity duration-fast ease-hover group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </button>
            </li>
          ))}
        </ul>
      </Appear>
    </section>
  );
}
