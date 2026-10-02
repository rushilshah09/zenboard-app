'use client';
// Meeting panel — the "2.2" card from MASTER_PRODUCT_PLAN.md. A meeting is a
// client conversation you keep a transcript/notes for, and the place feedback
// is born: type an ask, it becomes a first-class feedback item (source='meeting',
// linked back to this meeting and client) that then flows into the Feedback board
// and its revenue rollup. Transcript + extracted Feedback, in one calm panel.
//
// THE WRITE-UP (lib/meeting-notes.ts, MEETINGS_PLAN.md M2) replaced "Find action items": one read
// now produces the summary, the decisions, what each side owes and what is still open, instead of
// two lists. What it proposes still lands in the sections that already existed — your commitments
// as `[ ]` lines under Action items, their requests under Feedback — because those are the paths
// that make a proposal into data, and a second way to do it would be a second thing to trust.
//
// (Historic note, kept because the shape of the old flow explains this one.) "Find action items" had the clerk read the
// transcript and PROPOSE what you committed to and what the client asked for. A
// proposal is a question, drawn with the shared proposal row: the claim, the line
// of the transcript it came from, and two answers. Adding one goes through the
// same paths as typing it — a `[ ]` line in the transcript, or a feedback item —
// so nothing downstream knows or cares that the clerk wrote the first draft.
//
// BENCHMARK (rule 7). Notion AI's meeting notes and Granola both write a finished
// summary INTO the page: fast, and the right call for a notes app. Zenboard
// deliberately does not, because here an action item is a commitment that
// becomes a task, gets filed to a client's project and may reach their portal —
// a list of commitments is worthless the moment it contains one you did not
// make. So ours proposes, quotes its source on every row, and writes only what
// you add; Linear's suggestion-first triage is the nearer model.
import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { MessageSquare, CornerDownLeft, ListChecks, Square, SquareCheck, Sparkles, CalendarCheck, Clock, Users, Mic } from '@/components/ds/icons';
import {
  Icon, Badge, Button, Textarea, TextInput, SuggestionRow, PageView, RecordHeader, PropertyRow,
  DropdownMenuItem, useConfirm,
} from '@/components/ds/ui';
import { ViewContainer } from '@/components/ui/view-container';
import { recordHref } from '@/lib/connected';
import { formatStamp, talkShare, transcriptText } from '@/lib/meeting-transcript';
import { RecordControl, RecordStatus } from '@/components/meetings/record-control';
import { TranscriptView } from '@/components/meetings/transcript-view';
import { openAsk } from '@/components/ask/ask-panel';
import { useRecordParam } from '@/lib/hub-url';
import { ensureLoaded, onRecordingFinished, useMeetingTranscript } from '@/components/meetings/recording';
import { cn } from '@/lib/cn';
import { meetingActions, meetingDestination, promotable, actionsSummary, appendActionLines } from '@/lib/meeting-actions';
import type { MeetingTask } from '@/lib/meeting-actions';
import {
  MIN_TRANSCRIPT_CHARS, type Suggestion,
} from '@/lib/meeting-suggest';
import { unstable_isUnrecognizedActionError } from 'next/navigation';

import { MeetingWriteUp, type WriteUpState } from '@/components/meetings/meeting-writeup';
import {
  followUpTitle, openProposals, thrownNotesProblem, type MeetingNotes, type NotesProblem,
} from '@/lib/meeting-notes';
import { formatMoney } from '@/lib/money';
import { type FeedbackItem, FEEDBACK_TONE, FEEDBACK_LABEL } from '@/components/feedback/feedback-board';
import { formatDay, formatClock } from '@/lib/date';

export type MeetingItem = {
  id: string; client_id: string | null; title: string; notes: string | null;
  met_at: string; created_at?: string | null;
};

/** What writing up a meeting comes back with. The host never throws; a failure is a reason. */
export type WriteUpResult = { notes: MeetingNotes; kept: boolean } | { error: string; reason: NotesProblem };

// The section-label ROLE (CLAUDE.md), not a private 11px copy of it: seven files spelled their own.
const sectionLabel = 'text-overline text-ink-500';
const money = (n: number) => formatMoney(n);

function metDate(iso: string) {
  // A meeting's date line is a standalone focused date, so it spells both the
  // weekday and the month out — the one place `long` is for.
  return `${formatDay(iso, { weekday: 'long', long: true })} · ${formatClock(iso)}`;
}

// Suggestions outlive the panel for the rest of the visit. Closing a meeting and
// opening it again must not cost a second read of the same transcript — the
// shared pool pays for every one — and must not bring back what was dismissed.
// Deliberately NOT persisted: a proposal is a question about the transcript as
// it was, and the next visit can ask again.
const VISIT = new Map<string, { notes: MeetingNotes; kept: boolean }>();

export function MeetingPanel({
  meeting, clientName, feedback, tasks, projects, linkSupported, onClose, onSaveNotes, onAddFeedback, onMakeTask, onWriteUp, onLoadWriteUp, onDismissItem, onClearWriteUp, onDelete,
}: {
  meeting: MeetingItem;
  /** Who the meeting was with, for its header. */
  clientName?: string | null;
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
  /** Ask the clerk to write the meeting up. Absent ⇒ nothing is offered here at all. */
  onWriteUp?: (notes: string) => Promise<WriteUpResult>;
  /** The write-up already kept on this meeting (0047), read once when it opens. */
  onLoadWriteUp?: () => Promise<{ supported: boolean; notes: MeetingNotes | null }>;
  /** Remember a "no" so the next visit does not ask again. `key` is `list:key`. */
  onDismissItem?: (key: string) => Promise<unknown>;
  onClearWriteUp?: () => Promise<unknown>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t) { onAddFeedback(t); setDraft(''); } };

  // The transcript is saved on blur, but the action items are read from it as you
  // TYPE. Waiting for a blur would mean writing `[] call the printer` and watching
  // nothing happen, which reads as the feature being broken rather than pending.
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirm, confirmUI] = useConfirm();

  // A moment in the meeting, from an answer's receipt (`?t=271`, lib/meeting-ask.ts). Consumed once
  // shown, so the address does not carry it on to the next meeting opened.
  const [moment, setMoment] = useRecordParam('t');
  const focusAt = moment && /^\d{1,6}$/.test(moment) ? Number(moment) : null;
  const momentShown = useCallback(() => setMoment(null), [setMoment]);

  // The recorded transcript (0046), fetched once and kept growing while this meeting records.
  const recorded = useMeetingTranscript(meeting.id);
  useEffect(() => { void ensureLoaded(meeting.id); }, [meeting.id]);
  const spoken = recorded.segments.length > 0;
  const share = talkShare(recorded.segments);

  // The write-up outlives this panel for the rest of the visit: closing a meeting and reopening it
  // must not spend the shared pool again, and a kept one (0047) survives the visit entirely.
  const visit = VISIT.get(meeting.id);
  const [writeUp, setWriteUp] = useState<WriteUpState>(
    visit ? { status: 'ready', notes: visit.notes, kept: visit.kept }
          : { status: onLoadWriteUp ? 'loading' : 'idle', notes: null, kept: true },
  );
  const findRef = useRef<HTMLButtonElement>(null);

  // What is already kept on the meeting, read once. A meeting opened twice does not write twice.
  useEffect(() => {
    if (!onLoadWriteUp || visit) return;
    let live = true;
    void onLoadWriteUp()
      .then((r) => { if (live) setWriteUp({ status: 'ready', notes: r.notes, kept: r.supported }); })
      .catch(() => { if (live) setWriteUp({ status: 'idle', notes: null, kept: true }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  const rows = meetingActions(notes, tasks);
  const pending = promotable(rows);
  const summary = actionsSummary(rows);
  const destination = meetingDestination(projects);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const offered = writeUp.notes
    ? openProposals(writeUp.notes, notes, feedback.map((f) => f.title), clientName)
    : { mine: [] as Suggestion[], asks: [] as Suggestion[], theirs: [] as Suggestion[] };

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

  /** There is something to write up: your notes, or what was said, or both. */
  const material = notes.trim().length + transcriptText(recorded.segments).length;

  async function write(opts: { auto?: boolean } = {}) {
    if (!onWriteUp || writeUp.status === 'writing') return;
    // Checked on press, not by disabling the button: a control that is pale until you have typed
    // enough reads as absent to anyone who has not typed yet. Not said at all after a recording too
    // short to write up: nobody asked, so there is nothing to answer.
    if (material < MIN_TRANSCRIPT_CHARS) {
      if (!opts.auto) setWriteUp((w) => ({ ...w, status: 'ready', reason: 'short' }));
      return;
    }
    setWriteUp((w) => ({ ...w, status: 'writing', reason: undefined }));
    let res: WriteUpResult;
    try {
      res = await onWriteUp(notes);
    } catch (e) {
      setWriteUp((w) => ({ ...w, status: 'ready', reason: thrownNotesProblem(e, unstable_isUnrecognizedActionError) }));
      return;
    }
    if ('error' in res) {
      setWriteUp((w) => ({ ...w, status: 'ready', reason: opts.auto && res.reason === 'short' ? undefined : res.reason }));
      return;
    }
    // A new write-up replaces the last one. Dismissals are NOT cleared: the server carried forward
    // every "no" that still matches something this answer says (lib/meeting-notes.ts `verifyNotes`).
    VISIT.set(meeting.id, { notes: res.notes, kept: res.kept });
    setWriteUp({ status: 'ready', notes: res.notes, kept: res.kept });
  }

  // AFTER THE MEETING, THE NOTES WRITE THEMSELVES (the brief: "after the meeting, automatically
  // generate the summary…"). When this meeting's recording has finished — every piece transcribed
  // and saved (components/meetings/recording.ts `onRecordingFinished`) — it is written up without a
  // press, the way Granola's notes arrive as the call ends. While the meeting is OPEN: the write-up
  // is drawn here, and one written behind a closed page would not be kept until 0047 is applied.
  const writeRef = useRef(write);
  useEffect(() => { writeRef.current = write; });
  useEffect(() => onRecordingFinished((id) => {
    if (id === meeting.id) void writeRef.current({ auto: true });
  }), [meeting.id]);

  async function clearWriteUp() {
    VISIT.delete(meeting.id);
    setWriteUp({ status: 'idle', notes: null, kept: true });
    await onClearWriteUp?.();
  }

  // When a proposal leaves the list its buttons go with it, and focus would fall
  // to <body>. Hand it to the neighbour instead — the next proposal's Add, the
  // one before it, or the button that asked — so a keyboard can work through the
  // list in one place.
  function handOff(list: Suggestion[], gone: Suggestion[], group: 'a' | 'f') {
    const goneKeys = new Set(gone.map((s) => s.key));
    const at = list.findIndex((s) => goneKeys.has(s.key));
    const rest = list.filter((s) => !goneKeys.has(s.key));
    // The neighbour in this list; failing that, the first of the other list, so
    // finishing one group carries on into the next rather than back to the top.
    const other = group === 'a' ? offered.asks : offered.mine;
    const next = rest.length
      ? { group, key: rest[Math.min(Math.max(at, 0), rest.length - 1)].key }
      : other.length ? { group: group === 'a' ? 'f' : 'a', key: other[0].key } : null;
    requestAnimationFrame(() => {
      const target = next
        ? document.querySelector<HTMLElement>(`[data-suggestion="${next.group}:${CSS.escape(next.key)}"] button`)
        : findRef.current;
      target?.focus();
    });
  }

  /**
   * "Not this one." The write-up itself remembers, so a reload does not ask again — which is why
   * this writes to the kept notes rather than to a set that dies with the panel.
   */
  function dismiss(s: Suggestion, group: 'a' | 'f' | 't') {
    const list = group === 'a' ? 'mine' : group === 'f' ? 'asks' : 'theirs';
    setWriteUp((w) => (w.notes
      ? { ...w, notes: { ...w.notes, dismissed: [...new Set([...w.notes.dismissed, `${list}:${s.key}`])] } }
      : w));
    const v = VISIT.get(meeting.id);
    if (v) VISIT.set(meeting.id, { ...v, notes: { ...v.notes, dismissed: [...new Set([...v.notes.dismissed, `${list}:${s.key}`])] } });
    void onDismissItem?.(`${list}:${s.key}`);
    if (group !== 't') handOff(group === 'a' ? offered.mine : offered.asks, [s], group);
  }

  /** A promise of theirs becomes a `[ ]` line of yours, the same path as any other action item. */
  function followUp(s: Suggestion) {
    const next = appendActionLines(notes, [followUpTitle(s, clientName)]);
    setNotes(next);
    onSaveNotes(next);
  }

  /** Accepted proposals become `[ ]` lines, and are saved at once: no blur will come to save them. */
  function addActions(items: Suggestion[]) {
    const next = appendActionLines(notes, items.map((s) => s.text));
    setNotes(next);
    onSaveNotes(next);
    handOff(offered.mine, items, 'a');
  }

  // Permanent, so it asks — and counts what goes with it. The tasks stay: the work was agreed to.
  async function remove() {
    const ok = await confirm({
      title: `Delete “${meeting.title}”?`,
      body: spoken
        ? 'Its notes and its transcript are deleted too. Tasks it produced stay. This can’t be undone.'
        : 'Its notes are deleted too. Tasks it produced stay. This can’t be undone.',
      actionLabel: 'Delete meeting',
      tone: 'danger',
    });
    if (ok) onDelete();
  }

  function addAsk(s: Suggestion) {
    onAddFeedback(s.text);
    handOff(offered.asks, [s], 'f');
  }


  return (
    <PageView
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      contentType="meeting"
      title={meeting.title}
      href={recordHref('meeting', meeting.id)}
      actions={(
        <>
          {/* Ask, already looking at this meeting: the panel reads it from the address, so "what
              did they say about the budget?" needs no "in which meeting". A quiet ghost beside
              Record, never a second filled button. */}
          <Button size="sm" variant="ghost" icon={<Icon icon={Sparkles} size={16} />} onClick={() => openAsk()}>Ask</Button>
          <RecordControl meeting={{ id: meeting.id, title: meeting.title }} />
        </>
      )}
      more={<DropdownMenuItem danger onSelect={() => { void remove(); }}>Delete meeting</DropdownMenuItem>}
    >
      <ViewContainer width="wide" className="page-rhythm">
      <RecordHeader
        identity={<Icon icon={CalendarCheck} size={20} className="text-ink-500" />}
        title={meeting.title}
      >
        <PropertyRow icon={Clock} label="When">{metDate(meeting.met_at)}</PropertyRow>
        {clientName && <PropertyRow icon={Users} label="With">{clientName}</PropertyRow>}
        {spoken && (
          <PropertyRow icon={Mic} label="Recorded">
            <span className="tabular-nums">{formatStamp(recorded.duration)}</span>
            {/* Talk and listen, measured on the two channels — never a guess. */}
            {share && <span className="text-ink-500"> · you spoke {share.mine}% of the time</span>}
          </PropertyRow>
        )}
      </RecordHeader>
      <RecordStatus meetingId={meeting.id} />
      <div className="flex flex-col gap-8">
        {/* THE WRITE-UP FIRST (MEETINGS_PLAN.md M2). What the meeting was and where it landed is
            what you came back for; the notes and the transcript it was written from are below it,
            which is also the order Granola and Otter settled on. */}
        {onWriteUp && (
          <MeetingWriteUp
            state={writeUp}
            canWrite={material >= MIN_TRANSCRIPT_CHARS}
            theirs={offered.theirs}
            onWrite={() => void write()}
            onClear={() => void clearWriteUp()}
            onFollowUp={followUp}
            onDismissTheirs={(s) => dismiss(s, 't')}
          />
        )}
        {/* Your notes beside what was said: side by side when there is room, the notes first when
            there is not — they are yours, and the transcript is the record under them. */}
        <div className="@container">
          <div className="grid gap-8 @3xl:grid-cols-2">
            <section aria-label="Notes">
              <div className={`${sectionLabel} mb-2`}>Notes</div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={(e) => onSaveNotes(e.target.value)}
                placeholder="Jot what matters as you listen… start a line with [] to mark an action item"
                rows={10}
              />
            </section>
            <section aria-label="Transcript">
              <div className={`${sectionLabel} mb-2`}>Transcript</div>
              <TranscriptView meetingId={meeting.id} focusAt={focusAt} onFocused={momentShown} />
            </section>
          </div>
        </div>

        {/* ── ACTION ITEMS ─────────────────────────────────────────────────
            What the meeting committed US to, as opposed to Feedback below,
            which is what the client wants. Both are outputs of the same
            conversation and neither is the other: one becomes work now, one
            becomes work when it is worth the revenue behind it. */}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
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
            offered.mine.length === 0 && (
              <div className="flex items-center gap-2 py-1.5 text-ui text-ink-500">
                <Icon icon={ListChecks} size={16} className="text-ink-500" />
                {/* One run of text, so it wraps as a sentence on a phone instead of three columns. */}
                <span>Start a line with <span className="font-mono text-caption text-ink-600">[]</span> in your notes to mark an action item.</span>
              </div>
            )
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

          {offered.mine.length > 0 && (
            <Proposals
              label="Suggested action items"
              count={offered.mine.length}
              onAddAll={offered.mine.length > 1 ? () => addActions(offered.mine) : undefined}
            >
              {offered.mine.map((s) => (
                <SuggestionRow
                  key={s.key}
                  data-suggestion={`a:${s.key}`}
                  receipt={`“${s.evidence}”`}
                  acceptLabel="Add"
                  onAccept={() => addActions([s])}
                  dismissLabel={`Dismiss: ${s.text}`}
                  onDismiss={() => dismiss(s, 'a')}
                >
                  {s.text}
                </SuggestionRow>
              ))}
            </Proposals>
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
              offered.asks.length === 0 && (
                <div className="flex items-center gap-2 py-1.5 text-ui text-ink-500">
                  <Icon icon={MessageSquare} size={16} className="text-ink-500" />
                  Nothing pulled out yet. Capture what they asked for above.
                </div>
              )
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

          {offered.asks.length > 0 && (
            <Proposals label="Suggested feedback" count={offered.asks.length}>
              {offered.asks.map((s) => (
                <SuggestionRow
                  key={s.key}
                  data-suggestion={`f:${s.key}`}
                  receipt={`“${s.evidence}”`}
                  acceptLabel="Add"
                  onAccept={() => addAsk(s)}
                  dismissLabel={`Dismiss: ${s.text}`}
                  onDismiss={() => dismiss(s, 'f')}
                >
                  {s.text}
                </SuggestionRow>
              ))}
            </Proposals>
          )}
        </div>
      </div>
      </ViewContainer>
      {confirmUI}
    </PageView>
  );
}

/**
 * A group of proposals under the list they would join. Headed by what they are
 * and how many, with Add all when there is more than one — accepting a meeting's
 * worth of commitments should be one press, not five.
 */
function Proposals({ label, count, onAddAll, children }: {
  label: string;
  count: number;
  onAddAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="mt-3 rounded-md border border-line-soft px-3 pb-1 pt-2">
      <div className="flex items-center gap-2">
        <Icon icon={Sparkles} size={16} className="text-ink-500" />
        <span className="text-caption text-ink-600">{label}</span>
        <span className="tabular-nums text-caption text-ink-500">{count}</span>
        <span className="flex-1" />
        {onAddAll && <Button size="xs" variant="ghost" onClick={onAddAll}>Add all</Button>}
      </div>
      <ul className="divide-y divide-line-soft">{children}</ul>
    </section>
  );
}
