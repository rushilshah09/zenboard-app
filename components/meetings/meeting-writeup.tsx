'use client';
// The write-up, at the top of a meeting (MEETINGS_PLAN.md M2): what the meeting was, what was
// decided, what they will do, what is still open — written by the clerk from your notes and the
// transcript, every line with the words it came from (lib/meeting-notes.ts).
//
// BENCHMARK (rule 7). Granola and Otter put a finished summary at the top of the page when the
// meeting ends, and so does this — automatically after a recording, on a press otherwise. Where it
// deliberately differs is the receipts: each decision, promise and question shows the sentence it
// was taken from, because a line in "decisions" that nobody actually decided is how a client and a
// freelancer end up remembering two different meetings.
//
// What you OWE is not here: your action items and the client's requests are proposals in their own
// sections below (Action items, Feedback), where adding them has always happened. Their promises
// get "Follow up", which puts a `[ ] Follow up: …` line in your notes — the same path as any other
// action item, so a follow-up becomes a task the ordinary way.

import { Badge, Button, EmptyLine, Icon, IconButton } from '@/components/ds/ui';
import { CornerDownLeft, Sparkles, X } from '@/components/ds/icons';
import {
  KIND_LABEL, NOTES_MESSAGES, isEmptyNotes, retryableNotes, type MeetingNotes, type NotesProblem,
} from '@/lib/meeting-notes';
import type { Suggestion } from '@/lib/meeting-suggest';
import { formatAgo } from '@/lib/date';

export type WriteUpState = {
  status: 'idle' | 'loading' | 'writing' | 'ready' | 'failed';
  notes: MeetingNotes | null;
  /** Kept on the meeting (0047). False: shown for this visit only. */
  kept: boolean;
  reason?: NotesProblem;
};

const sectionLabel = 'text-overline text-ink-500';

export function MeetingWriteUp({
  state, canWrite, theirs, onWrite, onClear, onFollowUp, onDismissTheirs,
}: {
  state: WriteUpState;
  /** There is something to write up (notes or a transcript). */
  canWrite: boolean;
  /** Their promises still worth offering a follow-up for. */
  theirs: Suggestion[];
  onWrite: () => void;
  onClear: () => void;
  onFollowUp: (s: Suggestion) => void;
  onDismissTheirs: (s: Suggestion) => void;
}) {
  const n = state.notes;
  const writing = state.status === 'writing';

  if (state.status === 'loading') return null;
  // Nothing written, nothing to write from, nothing to say: no section at all. Not `status ===
  // 'idle'` alone — a meeting whose saved write-up has just loaded as "none" is `ready` with no
  // notes, and that is the COMMON case (found 2026-09-29: every unwritten meeting drew a bare
  // "Summary" heading over an empty band).
  if (!n && !writing && !state.reason && !canWrite) return null;

  const header = (
    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={sectionLabel}>Summary</span>
      {n && <Badge status="neutral">{KIND_LABEL[n.kind]}</Badge>}
      {n && !writing && (
        <span className="text-caption text-ink-500">
          {/* The house's one elapsed-time formatter (lib/date.ts), as every other "when" line reads. */}
          Written by Zenboard {formatAgo(n.at, { precise: true })}
        </span>
      )}
      <span className="flex-1" />
      {(n || canWrite) && (
        <Button size="sm" variant="ghost" icon={<Icon icon={Sparkles} size={16} />} loading={writing} onClick={onWrite}>
          {n ? 'Write again' : 'Write up notes'}
        </Button>
      )}
      {n && !writing && <IconButton size="sm" variant="ghost" label="Remove the write-up" icon={<Icon icon={X} size={16} />} onClick={onClear} />}
    </div>
  );

  return (
    // No margin of its own: the meeting page's column spaces its sections (gap-8), and a margin here
    // doubled the one gap above the notes to 64px (measured 2026-09-29).
    <section aria-label="Summary">
      {header}
      {/* One live line for what the clerk is doing or why it could not. */}
      <div aria-live="polite">
        {writing && <p className="mb-2 text-caption text-ink-500">Writing up the notes from what was said…</p>}
        {state.reason && !writing && (
          <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-caption text-ink-600">
            <span>{NOTES_MESSAGES[state.reason]}</span>
            {retryableNotes(state.reason) && <Button variant="link" size="sm" className="text-caption" onClick={onWrite}>Try again</Button>}
          </p>
        )}
      </div>

      {!n && !writing && !state.reason && (
        <EmptyLine>Zenboard writes the summary, the decisions and what happens next from your notes and the transcript.</EmptyLine>
      )}

      {n && isEmptyNotes(n) && <EmptyLine>Nothing to write up in this meeting yet.</EmptyLine>}

      {n && !isEmptyNotes(n) && (
        <div className="flex flex-col gap-5">
          {n.summary && <p className="text-body text-ink-800">{n.summary}</p>}
          {n.truncated && <p className="text-caption text-ink-500">This meeting was long, so only its first part was read.</p>}
          {/* 0047 not applied: said in the person's words, not the migration's. */}
          {!state.kept && <p className="text-caption text-ink-500">This summary isn’t saved yet, so it will be gone after a reload.</p>}
          {/* WHAT THIS KIND OF MEETING IS HELD TO FIND OUT (lib/meeting-notes.ts `KIND_DETAILS`) —
              MeetGeek's templates, without a template to configure: a discovery call shows the
              budget and who decides, a kickoff the scope and the deadline, and a check-in neither,
              because `verifyNotes` keeps a detail only under a label its own kind offers. */}
          {n.details.length > 0 && (
            <div>
              <div className={`${sectionLabel} mb-1`}>{KIND_LABEL[n.kind]} details</div>
              <dl className="divide-y divide-line-soft">
                {n.details.map((d) => (
                  <div key={d.key} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                    <dt className="text-ui text-ink-500 sm:w-32 sm:shrink-0">{d.label}</dt>
                    <dd className="min-w-0 flex-1">
                      <p className="text-ui text-ink-800">{d.text}</p>
                      <p className="pt-0.5 text-caption text-ink-500">“{d.evidence}”</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <Quoted label="Decisions" items={n.decisions} />
          {theirs.length > 0 && (
            <div>
              <div className={`${sectionLabel} mb-1`}>What they’ll do</div>
              <ul className="divide-y divide-line-soft">
                {theirs.map((s) => (
                  <li key={s.key} data-suggestion={`theirs:${s.key}`} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-ui text-ink-800">{s.text}</p>
                      <p className="pt-0.5 text-caption text-ink-500">“{s.evidence}”</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="secondary" icon={<Icon icon={CornerDownLeft} size={16} />} onClick={() => onFollowUp(s)}>
                        Follow up
                      </Button>
                      <IconButton size="sm" variant="ghost" label={`Dismiss: ${s.text}`} icon={<Icon icon={X} size={16} />} onClick={() => onDismissTheirs(s)} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Quoted label="Open questions" items={n.questions} />
        </div>
      )}
    </section>
  );
}

/** A list of statements, each with the words it was taken from. */
function Quoted({ label, items }: { label: string; items: Suggestion[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`${sectionLabel} mb-1`}>{label}</div>
      <ul className="divide-y divide-line-soft">
        {items.map((s) => (
          <li key={s.key} className="py-2">
            <p className="text-ui text-ink-800">{s.text}</p>
            <p className="pt-0.5 text-caption text-ink-500">“{s.evidence}”</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
