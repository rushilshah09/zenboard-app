'use client';
// A meeting's transcript, as it is read: turns rather than fragments — each speaker's consecutive
// sentences together, with the time they started and who said them (lib/meeting-transcript.ts).
//
// While the meeting records, the newest words arrive at the bottom a few seconds after they are
// spoken. The list follows them only while you are reading the bottom: scroll up to find something
// said earlier and it stays where you put it, the way a chat does — a transcript that yanks you back
// down mid-sentence is one you cannot use during the meeting it is transcribing.
//
// A MOMENT CAN BE ASKED FOR (MEETINGS_PLAN M3). An answer in Ask rests on lines of the meeting, and
// each one opens the meeting at `?t=<seconds>`. The turn holding that second is scrolled to, washed
// as the selection, and given focus — so a keyboard or a screen reader arrives where the eye does.
// The wash stays until another moment is asked for: it marks where you came in, which is worth
// keeping while you read around it.
import { useLayoutEffect, useRef, useState } from 'react';

import { EmptyLine } from '@/components/ds/ui';
import { SPEAKER_LABEL, TRANSCRIBE_MESSAGES, formatStamp, turns } from '@/lib/meeting-transcript';
import { useMeetingTranscript, useRecording } from '@/components/meetings/recording';

/** Within this many pixels of the bottom counts as reading the bottom. */
const FOLLOW_SLACK = 48;

/** The turn a moment falls in: the last one to start at or before it (the first, for a moment before any). */
function turnAt<T extends { start: number }>(groups: readonly T[], at: number): T | undefined {
  let found = groups[0];
  for (const g of groups) {
    if (g.start > at) break;
    found = g;
  }
  return found;
}

export function TranscriptView({ meetingId, focusAt = null, onFocused }: {
  meetingId: string;
  /** A moment to show, in seconds — from the URL's `t`. */
  focusAt?: number | null;
  /** The moment has been shown, so the address can let go of it. */
  onFocused?: () => void;
}) {
  const t = useMeetingTranscript(meetingId);
  const rec = useRecording();
  const live = rec.meetingId === meetingId && (rec.status === 'recording' || rec.status === 'paused' || rec.status === 'starting');
  const groups = turns(t.segments);

  const box = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const count = t.segments.length;
  useLayoutEffect(() => {
    const el = box.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  // Each new value of `focusAt` is one request, read during render rather than mirrored in an
  // effect ([[zenboard-use-server-state]]); it is served once the words it points at have loaded,
  // which on a cold open is after the saved transcript arrives.
  const [request, setRequest] = useState<{ at: number; n: number } | null>(null);
  const [seen, setSeen] = useState<number | null>(null);
  if (focusAt !== seen) {
    setSeen(focusAt);
    if (focusAt !== null) setRequest({ at: focusAt, n: (request?.n ?? 0) + 1 });
  }
  const marked = request ? turnAt(groups, request.at)?.start ?? null : null;
  const served = useRef(0);
  useLayoutEffect(() => {
    if (!request || served.current === request.n || marked === null) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-start="${marked}"]`);
    if (!el) return;
    served.current = request.n;
    // Reading an earlier moment: live words arriving at the bottom must not pull you away from it.
    following.current = false;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
    onFocused?.();
  }, [request, marked, onFocused]);

  if (groups.length === 0) {
    if (live) return <EmptyLine>Listening. The first words appear a few seconds after someone speaks.</EmptyLine>;
    if (t.pending > 0) return <EmptyLine>Transcribing the recording…</EmptyLine>;
    if (t.loaded === 'loading') return <EmptyLine>Loading the transcript…</EmptyLine>;
    return <EmptyLine>Record the meeting and what’s said appears here, with who said it.</EmptyLine>;
  }

  return (
    <div>
      <div
        ref={box}
        // Bleeds 8px into the section's margin with 8px of padding back, so a washed turn can
        // reach past its text without the region's `overflow-x: hidden` clipping it — and the
        // words stay exactly where they were.
        onScroll={(e) => {
          const el = e.currentTarget;
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK;
        }}
        className="scroll-region -mx-2 max-h-96 px-2"
        // A live region would read every sentence aloud as it lands, for an hour. The transcript is
        // a document to navigate; the recording status line is what announces changes.
        role="log"
        aria-live="off"
        aria-label="Transcript"
      >
        <ol className="flex flex-col gap-1 pr-2">
          {groups.map((g) => (
            <li
              key={g.segments[0].id}
              data-start={g.start}
              tabIndex={-1}
              className={`focus-ring -mx-2 flex gap-2 rounded-md px-2 py-1 ${g.start === marked ? 'bg-surface-selected' : ''}`}
            >
              <span className="w-12 shrink-0 pt-px text-caption tabular-nums text-ink-500">{formatStamp(g.start)}</span>
              <div className="min-w-0 flex-1">
                {g.speaker && <div className="text-caption font-medium text-ink-600">{SPEAKER_LABEL[g.speaker]}</div>}
                <p className="text-ui text-ink-800">{g.segments.map((s) => s.text).join(' ')}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {(t.pending > 0 || !t.saves) && (
        <p className="mt-2 text-caption text-ink-500">
          {t.pending > 0 && (live ? 'Catching up with the last few seconds…' : `Transcribing the last ${t.pending === 1 ? 'piece' : `${t.pending} pieces`}…`)}
          {t.pending > 0 && !t.saves && ' '}
          {!t.saves && TRANSCRIBE_MESSAGES.migration}
        </p>
      )}
    </div>
  );
}
