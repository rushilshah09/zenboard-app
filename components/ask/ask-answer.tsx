'use client';
// ── AN ANSWER, DRAWN ────────────────────────────────────────────────────────
//
// One `AskAnswer` from `lib/actions/ask.ts`, rendered. Every piece of it is a component this
// product already has, and two of those choices are the point of the file:
//
// **Tasks are drawn with `<TaskRow>`** — the same row Home's plan draws, and the Tasks page, and a
// project's Tasks tab. Not a summary of your tasks; your tasks. So the checkbox works, the title
// opens the drawer, and priority, estimate and project chip read exactly as they do everywhere
// else. That is PRODUCT_CONTEXT's "ONE OBJECT, MANY VIEWS" taken literally: a conversation is
// another view, so it uses the view's component and a row here is not a fourth thing to learn.
//
// **An offer is drawn with `<SuggestionRow>`** — the house's proposal row (§7Q: "AI proposes,
// never writes silently; every suggestion is a one-tap accept"), already used by the Noticed band
// and meeting suggestions. Its `receipt` slot is why it fits: a proposal here must show the
// evidence it rests on, and the evidence is the sentence the person typed. It also settles the
// button: accept is SECONDARY, everywhere in this product, which keeps the panel at zero
// filled-accent controls rather than one per turn.
//
// Links go through `recordHref`, the one address in this product, so a record found in Ask lands
// exactly where the same record lands from the command palette or a Connected row.

import * as React from 'react';

import { ArrowUpRight } from '@/components/ds/icons';
import { Button, Icon, QuoteRow, SuggestionRow } from '@/components/ds/ui';
import { TaskRow } from '@/components/tasks/task-row';
import type { AskAnswer, Proposal } from '@/lib/actions/ask';
import type { Candidate } from '@/lib/ask';
import { answerBlocks } from '@/lib/answer-blocks';

export type AnswerActions = {
  /** Accept an offer. */
  onRun: (proposal: Proposal) => void;
  /** Answer "which one?" — or decline to. */
  onChoose: (option: Candidate) => void;
  /** Drop an offer or a question without answering it. */
  onDismiss: () => void;
  /** Tick a task shown in an answer — the same act as ticking it anywhere else. */
  onToggleTask: (id: string, done: boolean) => void;
  /** Open a record. Closes the panel, because you asked to go there. */
  onOpen: (href: string) => void;
  /** This turn's act is in flight, so nothing can be pressed twice. */
  busy?: boolean;
};

/**
 * A row that opens a record: ghost, full width, left-aligned — the DS Button, not a new row type.
 *
 * **IT CARRIES NO TYPE GLYPH, AND THAT IS THE POINT.** A task's face in this product is
 * `SquareCheck`, a TICKED BOX — correct in the command palette and the @-picker, and wrong here,
 * because this panel also draws real `<TaskRow>` checkboxes a few pixels above. Verified in the
 * browser: "Buildojo logo v2 ☑" in a list of things to choose between reads as one that is
 * already done. That is the same fault [[zenboard-system-before-screen]] recorded once before —
 * one glyph, two opposite meanings — so the rule for this panel is that a checkbox shape here is
 * always a real, operable checkbox. What a row IS gets said in words (`note`) instead, and what it
 * DOES is said by the arrow.
 */
function RecordRow({ label, note, onOpen, disabled }: {
  label: string; note?: string; onOpen?: () => void; disabled?: boolean;
}) {
  const opens = !!onOpen && !disabled;
  return (
    <Button variant="ghost" size="sm" fullWidth disabled={disabled || !onOpen} onClick={onOpen} className="justify-start gap-2">
      <span className="min-w-0 flex-1 truncate text-start">{label}</span>
      {/* Tabular so a column of times does not shuffle as it is read. */}
      {note && <span className="shrink-0 text-caption tabular-nums text-ink-500">{note}</span>}
      {opens && <Icon icon={ArrowUpRight} size={14} className="shrink-0 text-ink-500" />}
    </Button>
  );
}

export function AskAnswerView({ answer, said, actions }: { answer: AskAnswer; said: string; actions: AnswerActions }) {
  return (
    <div className="space-y-2">
      {/* An offer states itself inside the SuggestionRow, so it does not also say it here. */}
      {answer.kind !== 'offer' && answer.kind !== 'quoted' && (
        <p className={answer.kind === 'error' ? 'text-ui text-danger-600' : 'text-ui text-ink-800'} role={answer.kind === 'error' ? 'alert' : undefined}>
          {answer.text}
        </p>
      )}

      {/* A meeting's answer may be prose or a short list ("what are my action items?"), drawn as
          what it is rather than as dashes in a paragraph. */}
      {answer.kind === 'quoted' && answerBlocks(answer.text).map((b, i) => (b.kind === 'p' ? (
        <p key={i} className="text-ui text-ink-800">{b.text}</p>
      ) : (
        <ul key={i} className="list-disc space-y-0.5 ps-5 text-ui text-ink-800 marker:text-ink-500">
          {b.items.map((item, j) => <li key={j}>{item}</li>)}
        </ul>
      )))}

      {answer.kind === 'did' && answer.record && (
        <RecordRow label={`Open ${answer.record.label}`} onOpen={answer.record.href ? () => actions.onOpen(answer.record!.href!) : undefined} />
      )}

      {answer.kind === 'offer' && (
        <ul>
          <SuggestionRow
            receipt={`You said: "${said}"`}
            acceptLabel="Do it"
            onAccept={() => actions.onRun(answer.proposal)}
            dismissLabel={`Dismiss: ${answer.text}`}
            onDismiss={actions.onDismiss}
            busy={actions.busy}
          >
            {answer.text}
          </SuggestionRow>
        </ul>
      )}

      {answer.kind === 'choose' && (
        <div className="space-y-1">
          {answer.options.map((o) => (
            // A meeting is told apart by WHEN it was, so its day is shown; a task's hint is an ISO
            // day id and is not for reading.
            <RecordRow key={o.id} label={o.label} note={answer.then === 'ask_meeting' ? o.hint ?? undefined : undefined} disabled={actions.busy} onOpen={() => actions.onChoose(o)} />
          ))}
          <Button variant="ghost" size="sm" disabled={actions.busy} onClick={actions.onDismiss}>None of these</Button>
        </div>
      )}

      {answer.kind === 'tasks' && answer.tasks.length > 0 && (
        // A list in an answer is ROWS, not a box of rows: hairlines above and below and between,
        // the rows' own wash on hover — the same task rows as everywhere else, without a frame
        // around them (2026-10-02 brief: "avoid putting every row inside a card").
        <ul className="border-y border-line-soft">
          {answer.tasks.map((t, i) => (
            <li key={t.id}>
              <TaskRow
                task={t}
                project={t.project}
                last={i === answer.tasks.length - 1}
                onToggle={() => actions.onToggleTask(t.id, !t.done)}
                onOpen={() => actions.onOpen(`/tasks?task=${t.id}`)}
              />
            </li>
          ))}
        </ul>
      )}

      {answer.kind === 'agenda' && answer.events.length > 0 && (
        <div className="space-y-1">
          {answer.events.map((e) => (
            <RecordRow key={e.id} label={e.title} note={e.allDay ? 'All day' : e.clock} onOpen={() => actions.onOpen(`/calendar?event=${e.id}`)} />
          ))}
        </div>
      )}

      {/* An answer read from a meeting: the lines it rests on, each opening the meeting at its
          moment (lib/meeting-ask.ts), and the meeting itself. */}
      {answer.kind === 'quoted' && (
        <>
          {answer.partial && (
            <p className="text-caption text-ink-500">This is a long meeting, so I read the parts that match your question.</p>
          )}
          {answer.quotes.length > 0 && (
            <ul aria-label="What this rests on">
              {answer.quotes.map((q) => (
                <li key={`${q.href}:${q.text}`}>
                  <QuoteRow source={q.source} onOpen={() => actions.onOpen(q.href)}>{q.text}</QuoteRow>
                </li>
              ))}
            </ul>
          )}
          {answer.record.href && (
            <RecordRow label={`Open ${answer.record.label}`} onOpen={() => actions.onOpen(answer.record.href!)} />
          )}
        </>
      )}

      {answer.kind === 'found' && answer.hits.length > 0 && (
        <div className="space-y-1">
          {answer.hits.map((h) => (
            <RecordRow key={`${h.type}:${h.id}`} label={h.label} note={h.type} onOpen={h.href ? () => actions.onOpen(h.href!) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
