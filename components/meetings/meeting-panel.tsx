'use client';
// Meeting panel — the "2.2" card from MASTER_PRODUCT_PLAN.md. A meeting is a
// client conversation you keep a transcript/notes for, and the place feedback
// is born: type an ask, it becomes a first-class feedback item (source='meeting',
// linked back to this meeting and client) that then flows into the Feedback board
// and its revenue rollup. Transcript + extracted Feedback, in one calm panel.
import { useState } from 'react';
import NextLink from 'next/link';
import { MessageSquare, CornerDownLeft, ListChecks, Square, SquareCheck } from '@/components/ds/icons';
import { Icon, Badge, Button, Modal, Textarea, TextInput } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { meetingActions, meetingDestination, promotable, actionsSummary } from '@/lib/meeting-actions';
import type { MeetingTask } from '@/lib/meeting-actions';
import { formatMoney } from '@/lib/money';
import { type FeedbackItem, FEEDBACK_TONE, FEEDBACK_LABEL } from '@/components/feedback/feedback-board';
import { formatDay, formatClock } from '@/lib/date';

export type MeetingItem = {
  id: string; client_id: string | null; title: string; notes: string | null;
  met_at: string; created_at?: string | null;
};

// The section-label ROLE (CLAUDE.md), not a private 11px copy of it: seven files spelled their own.
const sectionLabel = 'text-overline text-ink-500';
const money = (n: number) => formatMoney(n);

function metDate(iso: string) {
  // A meeting's date line is a standalone focused date, so it spells both the
  // weekday and the month out — the one place `long` is for.
  return `${formatDay(iso, { weekday: 'long', long: true })} · ${formatClock(iso)}`;
}

export function MeetingPanel({
  meeting, feedback, tasks, projects, linkSupported, onClose, onSaveNotes, onAddFeedback, onMakeTask, onDelete,
}: {
  meeting: MeetingItem;
  feedback: FeedbackItem[];
  /** The tasks this meeting has already produced (PRODUCT_THINKING §8). */
  tasks: MeetingTask[];
  /** The client's projects — only used to name where a new task will be filed. */
  projects: { id: string; name: string; status: string }[];
  /** False when 0027 is missing: an action item cannot be linked, so it is not offered. */
  linkSupported: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  onAddFeedback: (title: string) => void;
  onMakeTask: (title: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t) { onAddFeedback(t); setDraft(''); } };

  // The transcript is saved on blur, but the action items are read from it as you
  // TYPE. Waiting for a blur would mean writing `[] call the printer` and watching
  // nothing happen, which reads as the feature being broken rather than pending.
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const rows = meetingActions(notes, tasks);
  const pending = promotable(rows);
  const summary = actionsSummary(rows);
  const destination = meetingDestination(projects);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  async function make(titles: string[]) {
    setBusy((b) => new Set([...b, ...titles]));
    try {
      // Sequentially: two inserts racing for the same meeting would both miss the
      // other's edge and the duplicate guard would let both through.
      for (const t of titles) await onMakeTask(t);
    } finally {
      // `finally`, because a thrown action (an expired session does exactly that)
      // would otherwise leave the button spinning forever with nothing to say.
      setBusy((b) => { const n = new Set(b); titles.forEach((t) => n.delete(t)); return n; });
    }
  }

  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="lg"
      title={meeting.title} description={metDate(meeting.met_at)}
      footer={<><Button variant="dangerGhost" onClick={onDelete}>Delete meeting</Button><span className="flex-1" /><Button variant="secondary" onClick={onClose}>Done</Button></>}>
      <div className="flex flex-col gap-6">
        {/* Transcript / running notes */}
        <div>
          <div className={`${sectionLabel} mb-2`}>Transcript</div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => onSaveNotes(e.target.value)}
            placeholder="Paste the transcript, or jot what was said… start a line with [] to mark an action item"
            rows={6}
          />
        </div>

        {/* ── ACTION ITEMS ─────────────────────────────────────────────────
            What the meeting committed US to, as opposed to Feedback below,
            which is what the client wants. Both are outputs of the same
            conversation and neither is the other: one becomes work now, one
            becomes work when it is worth the revenue behind it. */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className={sectionLabel}>Action items</span>
            {summary && <span className="tabular-nums text-caption text-ink-500">{summary}</span>}
            <span className="flex-1" />
            {linkSupported && pending.length > 0 && (
              <Button
                size="sm" variant="secondary"
                loading={pending.every((r) => busy.has(r.text))}
                onClick={() => make(pending.map((r) => r.text))}
              >
                Make {pending.length} task{pending.length === 1 ? '' : 's'}
              </Button>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="flex items-center gap-2 py-1.5 text-ui text-ink-500">
              <Icon icon={ListChecks} size={16} className="text-ink-500" />
              Start a line with <span className="font-mono text-caption text-ink-600">[]</span> in the transcript to mark an action item.
            </div>
          ) : (
            <div>
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                  <Icon
                    icon={r.done ? SquareCheck : Square} size={16}
                    className={cn('shrink-0', r.done ? 'text-success-600' : 'text-ink-500')}
                  />
                  {/* Done reads the same whether the item is a task or still
                      just a line — a row's colour has to mean its state, not
                      which of the two shapes it happens to be in. */}
                  {r.task ? (
                    <NextLink href={`/tasks?task=${r.task.taskId}`}
                      className={cn('focus-ring min-w-0 flex-1 truncate rounded-xs text-ui transition-colors duration-fast hover:text-ink-900 hover:underline [@media(pointer:coarse)]:min-h-6',
                        r.done ? 'text-ink-500' : 'text-ink-800')}>
                      {r.text}
                    </NextLink>
                  ) : (
                    <span className={cn('min-w-0 flex-1 truncate text-ui', r.done ? 'text-ink-500' : 'text-ink-800')}>{r.text}</span>
                  )}
                  {r.orphan ? (
                    // The line was edited or deleted after the task was made. Say
                    // so — the same commitment appearing twice with no explanation
                    // is how someone ends up making a second task for it.
                    <span className="shrink-0 text-caption text-ink-500">Not in the transcript</span>
                  ) : r.task ? (
                    <span className="shrink-0 text-caption text-ink-500">
                      {(r.task.projectId && projectName.get(r.task.projectId)) || 'Inbox'}
                    </span>
                  ) : r.done ? null : linkSupported ? (
                    <Button size="sm" variant="ghost" loading={busy.has(r.text)} onClick={() => make([r.text])}>Make task</Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {linkSupported && pending.length > 0 && (
            <div className="mt-2 text-caption text-ink-500">Filed under {destination.label}.</div>
          )}
        </div>

        {/* Feedback extracted from this meeting */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className={sectionLabel}>Feedback</span>
            <span className="tabular-nums text-caption text-ink-500">{feedback.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                placeholder="What did they ask for? Pull it out as feedback…"
                autoComplete="off" data-1p-ignore data-lpignore="true"
              />
            </div>
            <Button variant={draft.trim() ? 'primary' : 'secondary'} disabled={!draft.trim()} iconRight={<Icon icon={CornerDownLeft} size={14} />} onClick={add}>Add</Button>
          </div>

          <div className="mt-3">
            {feedback.length === 0 ? (
              <div className="flex items-center gap-2 py-1.5 text-ui text-ink-500">
                <Icon icon={MessageSquare} size={16} className="text-ink-500" />
                Nothing pulled out yet — capture what they asked for above.
              </div>
            ) : feedback.map((f) => {
              const stake = f.deals.reduce((a, d) => a + d.value, 0);
              return (
                <div key={f.id} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                  <span className="shrink-0 tabular-nums text-caption text-ink-500">#{f.number}</span>
                  <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{f.title}</span>
                  {stake > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{money(stake)}</span>}
                  <Badge status={FEEDBACK_TONE[f.status]}>{FEEDBACK_LABEL[f.status]}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
