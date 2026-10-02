'use client';
// ── THE CONVERSATION ────────────────────────────────────────────────────────
//
// The transcript and the composer, shared by both of Ask's surfaces: the roomy mode on Home and
// the side panel that opens anywhere. One implementation, one store (`lib/ask-store.ts`), so the
// two are the same conversation rather than two products with the same name.
//
// The only thing the two surfaces disagree about is WIDTH and where the composer sits, which is
// what `variant` says:
//   · `page` — a reading column, the composer under the transcript, centred when nothing has been
//     said yet. That centring is the whole shape of the empty state on Home: one box, in the
//     middle, asking what you need.
//   · `panel` — a column in a drawer; the composer is the drawer's footer and is passed there by
//     `<AskPanel>`, so this renders the transcript alone.
//
// Everything else — what a turn looks like, what the actions do, what happens when a write fails —
// is the same code, because a person switching between them is not switching products.

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Check, ChevronRight, Copy, RotateCcw, Sparkles } from '@/components/ds/icons';
import { Button, Icon, IconButton, IconSwap, MessageComposer, toastReverted, type ComposerCheck, type MessageComposerProps, MarkThinking } from '@/components/ds/ui';
import { AskAnswerView, type AnswerActions } from '@/components/ask/ask-answer';
import { ask, chooseAndRun, runProposal, type AskRef, type Proposal } from '@/lib/actions/ask';
import { recordAskTurn } from '@/lib/actions/ask-history';
import { ASK_EXAMPLES, ASK_INPUT_MAX, type Candidate, type When } from '@/lib/ask';
import { todayISO } from '@/lib/date';
import { conversationWhen } from '@/lib/ask-history';
import { askStore, useAskState, withTaskDone, type Turn } from '@/lib/ask-store';
import { toggleTask } from '@/lib/actions/tasks';

/** The composer's bound, said before a round trip rather than after one. */
export const checkAsk = (raw: string): ComposerCheck => {
  const body = raw.trim();
  if (!body) return { ok: false, error: 'Say what you need.' };
  if (body.length > ASK_INPUT_MAX) {
    return { ok: false, error: `That is ${body.length.toLocaleString()} characters, and I can read ${ASK_INPUT_MAX.toLocaleString()} at a time.` };
  }
  return { ok: true, body };
};

/**
 * Ask a question and file the answer.
 *
 * Exported because both surfaces send, and because the panel's open event sends too — one function,
 * so "what happens when you press Enter" has one answer.
 */
export async function sendAsk(message: string, ref: AskRef | null, settle: () => void) {
  const id = askStore.start(message);
  const answer = await ask(message, ref);
  askStore.answer(id, answer);
  if (answer.kind === 'did') settle();

  // ── AND THEN IT IS FILED (migration 0049) ────────────────────────────────
  // AFTER the answer is on screen, never before: history is a convenience laid over Ask, not a
  // precondition for it. `recordAskTurn` swallows its own failures and returns a null id when the
  // migration has not been applied, so an unmigrated database gets today's behaviour exactly —
  // one conversation that ends on reload — and nobody sees an error about a table they have never
  // heard of. It is not awaited by the caller for the same reason: the person is already reading.
  void recordAskTurn(askStore.conversationId(), message, answer.text, answer)
    .then(({ conversationId }) => { if (conversationId) askStore.setConversation(conversationId); });
}

export function useAskActions(settle: () => void, onLeave?: () => void) {
  const router = useRouter();
  const { busy } = useAskState();

  return React.useCallback((turn: Turn): AnswerActions => ({
    busy,
    onRun: async (proposal: Proposal) => {
      askStore.working(true);
      const answer = await runProposal(proposal);
      askStore.answer(turn.id, answer);
      if (answer.kind === 'did') settle();
    },
    onChoose: async (option: Candidate) => {
      const answer = turn.answer;
      if (answer?.kind !== 'choose') return;
      const when: When | null = answer.when ?? null;
      askStore.working(true);
      const done = await chooseAndRun(option.id, answer.then, when, answer.question ?? null);
      askStore.answer(turn.id, done);
      if (done.kind === 'did') settle();
    },
    onDismiss: () => askStore.revise(turn.id, () => ({ kind: 'said', text: 'Left alone.' })),
    onToggleTask: async (taskId, done) => {
      // The same optimistic shape every other list in this app uses: flip, write, and on failure
      // put it back and say so in the ONE sentence `toastReverted` exists to keep identical.
      askStore.revise(turn.id, (a) => withTaskDone(a, taskId, done));
      const res = await toggleTask(taskId, done);
      if ('error' in res) {
        askStore.revise(turn.id, (a) => withTaskDone(a, taskId, !done));
        toastReverted(res.error);
        return;
      }
      settle();
    },
    onOpen: (href: string) => { onLeave?.(); router.push(href); },
  }), [busy, router, settle, onLeave]);
}

export function AskTranscript({ onSend, onLeave, examples }: {
  onSend: (message: string) => void;
  onLeave?: () => void;
  /** What to offer before anything is said — a meeting's own questions when one is open. */
  examples?: readonly string[];
}) {
  const { turns, busy, startedAt } = useAskState();
  const router = useRouter();
  const settle = React.useCallback(() => { router.refresh(); }, [router]);
  const actionsFor = useAskActions(settle, onLeave);
  const endRef = React.useRef<HTMLDivElement>(null);
  const stamp = React.useMemo(() => conversationWhen(startedAt, { today: todayISO() }), [startedAt]);

  // A new turn scrolls itself into view. `scrollIntoView` rather than a scrollTop write, so the
  // browser honours `prefers-reduced-motion` for us instead of us deciding it again.
  React.useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns]);

  if (turns.length === 0) return <AskEmpty onPick={onSend} examples={examples} />;

  return (
    <div className="space-y-6">
      {/* ── WHO IS SPEAKING, AND WHEN THE SITTING BEGAN ────────────────────────────────────────
             One quiet centred line above the first turn, the way both references head a
             conversation. It earns its place once chats are KEPT: reopening one from the rail
             lands you in the middle of something you said on Tuesday, and without a stamp the
             only clue is the content. The name is "Ask" because that is what this product calls
             it (the glossary is one name per concept) — never "Zenboard AI", which would be a
             second name for the same thing.
             `conversationWhen` names the DAY whenever it is not today, which is the whole point:
             this line was a bare clock, so Tuesday's conversation was headed `14:30` and read as
             half past two this afternoon — the stamp failing at the one case it was built for.
             `todayISO()` reads the clock, which a client component may not do during a render the
             server also performed. It cannot here, and that is structural rather than lucky: the
             store's server snapshot is a frozen EMPTY (lib/ask-store.ts), so `turns.length === 0`
             returns above and this line only ever renders after hydration. */}
      {stamp && <p className="text-center text-caption text-ink-500">Ask · {stamp}</p>}
      {turns.map((turn) => (
        <div key={turn.id} className="space-y-3">
          {/* ── WHAT YOU SAID, AS A PILL ON THE RIGHT ───────────────────────────────────────
              This was a left-bordered quote, with a note explaining why: "a chat bubble would be
              the one element here belonging to a different product". The user has now asked for
              the opposite, twice, with Claude's and Notion AI's transcripts beside a screenshot of
              ours ("i want like this full chat xpirence"). They are right about the thing the note
              missed: a quote rule says *this is an excerpt of a document*, and with the answer set
              in the same ink directly beneath it, there was nothing to tell you which line was
              yours. Side and shape do that work instantly and at a glance, which is why every
              chat in the world converged on them.
              It stays QUIET — `surface-fill`, the resting wash, and ink-800, not a filled accent.
              The bubble marks the speaker; it is not a decoration, and it is not a colour. */}
          <div className="flex justify-end">
            {/* The control radius family's large step (12), not a 20px pill: the speaker is marked by
                side and the resting wash, and an over-rounded bubble is the one shape here that would
                belong to a different product (2026-10-02 brief: no over-rounded containers). */}
            <p className="max-w-[78%] rounded-lg bg-surface-fill px-3 py-2 text-ui text-ink-800">{turn.said}</p>
          </div>
          {turn.answer?.trace?.length ? <AskThinking steps={turn.answer.trace} /> : null}
          {turn.pending ? (
            /* THE MARK THINKS, NOT A RING (user, 2026-09-29: "use my logo thinking and loading
               whol chting"). A spinner says a machine is FETCHING; nothing is being fetched —
               `lib/actions/ask.ts` is reading the caller's own records and choosing a command.
               The mark breathing says something is CONSIDERING, which is true, and it is this
               product's own mark rather than a ring every app shares. `<MarkThinking>` keeps
               `<Spinner>`'s two rules: held back by --delay-busy so a fast answer never flashes
               it, and one duration token so no call site writes a number. */
            <p className="flex items-center gap-2 text-ui text-ink-500">
              <MarkThinking size={16} /> Thinking
            </p>
          ) : (
            turn.answer && (
              <>
                <AskAnswerView answer={turn.answer} said={turn.said} actions={actionsFor(turn)} />
                <AnswerTools text={turn.answer.text} onRetry={() => onSend(turn.said)} disabled={busy} />
              </>
            )
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

/**
 * THE QUIET ROW UNDER AN ANSWER — copy it, or ask again.
 *
 * Both references put one here (Notion: copy · add · thumbs; Claude: copy · retry), and it is the
 * part of a chat transcript people reach for without thinking. Ours carries the two that DO
 * something: copying an answer is how it leaves the app, and asking again is the repair when a
 * sentence was read the wrong way — which, with the thinking block directly above showing exactly
 * how it was read, is a repair someone can make on purpose rather than by hoping.
 *
 * **Thumbs are deliberately not here.** A rating needs somewhere to go, and Zenboard has no store
 * for one; a control that only lights up is a lie about being listened to, and SPRINT_RULES rule 8
 * is that working is not the stopping condition. When feedback has a home it takes this row.
 *
 * Always visible rather than revealed on hover: the star/flag rule is for a glyph that MEANS
 * something about its row (a highlight, a flag), and these mean the same thing on every answer.
 * A row of controls that appears only once you guess it is there is not calmer, it is hidden.
 */
function AnswerTools({ text, onRetry, disabled }: { text: string; onRetry: () => void; disabled?: boolean }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // The tick IS the confirmation, so there is no toast: a toast for a copy is the app
      // interrupting to tell you the thing you just watched happen.
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toastReverted('Could not copy that.');
    }
  };

  return (
    <div className="flex items-center gap-1">
      <IconButton
        size="sm"
        label={copied ? 'Copied' : 'Copy answer'}
        onClick={copy}
        // `IconSwap`, not a ternary: an icon that changes with state CROSS-FADES through the
        // motion seam (app/design-system.test.ts catches the ternary by name), so the tick
        // arrives instead of replacing the clipboard on frame 0 — and the seam already handles
        // reduced motion and the keyboard path, which a ternary cannot.
        icon={<IconSwap swapKey={copied ? 'copied' : 'copy'}><Icon icon={copied ? Check : Copy} size={14} /></IconSwap>}
      />
      <IconButton
        size="sm"
        label="Ask again"
        disabled={disabled}
        onClick={onRetry}
        icon={<Icon icon={RotateCcw} size={14} />}
      />
    </div>
  );
}

/**
 * THE REASONING, FOLDED AWAY — what Ask decided before it answered.
 *
 * USER DIRECTION 2026-09-29: "Chain Of Thought preview", pointing at Claude's thinking block.
 * What is shown is NOT a token stream, and the difference is the point. `lib/ask.ts` is a command
 * spine: the model's entire output is one validated `AskCommand`, and it never writes, never names
 * a record and never computes a date — the app does all three. Streaming "thoughts" it did not
 * have would be theatre, and this product's standing rule for a machine's claim is that it comes
 * with evidence a person can check ("3 tasks in Meridian Coffee mention 'palette'", never
 * "92% confident").
 *
 * So the disclosure carries the three places Ask can misread you: the command it heard, the words
 * it took as the subject, and what a time phrase resolved to. Each is checkable at a glance, which
 * is what makes it worth opening — and why it is CLOSED by default. Someone who trusts the answer
 * reads one line; someone surprised by it gets the receipt without asking.
 *
 * `<details>`, not a hand-rolled disclosure: it is a summary and a body, the browser already
 * animates none of it, gives it a keyboard path and tells a screen reader whether it is open, and
 * `list-none` only removes the default marker. The DS has no disclosure primitive whose job is
 * this, and adding one for a single caller would be the fork this codebase keeps warning about.
 */
function AskThinking({ steps }: { steps: readonly { label: string; detail: string }[] }) {
  return (
    <details className="group">
      <summary
        className="focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-caption text-ink-500 hover:text-ink-700 [&::-webkit-details-marker]:hidden"
      >
        <Icon icon={ChevronRight} size={14} className="transition-transform duration-fast ease-hover group-open:rotate-90" />
        Thinking
      </summary>
      {/* The rail is the same gesture the quoted answer uses for a source: a line beside evidence.
          `ps-3` puts the first word under the summary's label rather than under its caret. */}
      <dl className="mt-1.5 space-y-1 border-s border-line-soft ps-3">
        {steps.map((s) => (
          <div key={`${s.label}-${s.detail}`} className="flex flex-wrap gap-x-1.5 text-caption">
            <dt className="text-ink-500">{s.label}</dt>
            <dd className="min-w-0 text-ink-700">{s.detail}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function AskComposer({ bare, autoFocus, size, lead, onSend }: {
  bare?: boolean;
  autoFocus?: boolean;
  /** `roomy` on Home, where the box IS the page; `compact` in the panel, inside a conversation. */
  size?: MessageComposerProps['size'];
  /** What Ask can see, for the footer band's quiet left end. */
  lead?: React.ReactNode;
  onSend: (message: string) => void;
}) {
  const { busy } = useAskState();
  return (
    <MessageComposer
      bare={bare}
      autoFocus={autoFocus}
      size={size}
      lead={lead}
      placeholder="Say what you need"
      check={checkAsk}
      disabled={busy}
      onSend={onSend}
    />
  );
}

export function AskEmpty({ onPick, compact, examples = ASK_EXAMPLES }: { onPick: (text: string) => void; compact?: boolean; examples?: readonly string[] }) {
  return (
    // Under 180px, one 20px plain glyph (no tinted circle), one title line, one sentence — the
    // empty-state rule. The examples are the single secondary action, and they are real sentences
    // in this product's own vocabulary rather than a feature list. Clicking one ASKS it: a person
    // who taps an example meant it, and prefilling would make them press Enter to agree with
    // themselves.
    //
    // `compact` drops the glyph and the title, for Home — where the greeting is already the page's
    // one title and the composer's placeholder already says these exact words. Saying them a third
    // time is not an empty state, it is an echo.
    <div className={compact ? 'text-center' : 'py-2'}>
      {!compact && <Icon icon={Sparkles} size={20} className="text-ink-500" />}
      {!compact && <p className="pt-2 text-ui font-medium text-ink-800">Say what you need</p>}
      <p className={compact ? 'text-caption text-ink-500' : 'pt-0.5 text-caption text-ink-500'}>Ask adds and moves tasks, puts things on your calendar, sets reminders, finds what you already have and answers questions about your meetings.</p>
      <ul className={compact ? 'flex flex-wrap justify-center gap-1.5 pt-3' : 'flex flex-wrap gap-1.5 pt-3'}>
        {examples.map((e) => (
          <li key={e}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="focus-ring rounded-sm bg-surface-fill px-2 py-1 text-caption text-ink-700 transition-colors hover:bg-surface-fill-hover"
            >
              {e}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Start again. Shown only once there is something to clear — an empty conversation has no reset.
 *
 * It says "New chat", the same words as the rail's own button. It said "New conversation", which is
 * the glossary fault CLAUDE.md names (one name per concept): the rail, the empty line ("Your chats
 * will appear here") and the address bar (`?chat=`) all call this thing a chat, and the panel called
 * it something else for the same act.
 */
export function AskReset() {
  const { turns, busy } = useAskState();
  if (turns.length === 0) return null;
  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => askStore.clear()}>New chat</Button>
  );
}
