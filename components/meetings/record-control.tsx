'use client';
// Recording a meeting, from the meeting itself (MEETINGS_PLAN.md, stage M1).
//
// ONE PRESS TO START, and one question asked the way Granola asks it: is this a call, or a room?
//   · A CALL records the microphone AND the call's own tab (Meet, Zoom or Teams in the browser),
//     which is what lets the transcript say "Me" and "Them" — the browser asks which tab to share.
//   · A ROOM records the microphone alone: in person, or a call on a phone.
// No bot joins anybody's meeting, and nothing is recorded that you did not choose.
//
// While recording: the time, a level for each channel (so a muted mic is seen, not discovered an hour
// later), pause, and stop. Every sentence it says is a real state the recorder can be in, and each
// tells you what to do next.
import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Icon } from '@/components/ds/ui';
import { CircleStop, Mic, Pause, Play } from '@/components/ds/icons';
import { cn } from '@/lib/cn';
import { recordHref } from '@/lib/connected';
import { recorderSupport, type RecorderWarning } from '@/lib/meeting-recorder';
import { TRANSCRIBE_MESSAGES, formatStamp } from '@/lib/meeting-transcript';
import {
  clearStartError, pauseRecording, resumeRecording, startRecording, stopRecording,
  useRecording, useRecordingLevels, type StartError,
} from '@/components/meetings/recording';

const START_ERRORS: Record<StartError, string> = {
  denied: 'Zenboard can’t use the microphone. Allow it from the address bar, then press Record again.',
  'no-device': 'No microphone was found. Connect one, then press Record again.',
  unsupported: 'This browser can’t record here. Chrome, Edge and Safari can.',
  busy: 'Another meeting is already recording. Stop it first.',
};

const WARNINGS: Record<RecorderWarning, string> = {
  'silent-mic': 'The microphone isn’t picking anything up. Check it isn’t muted.',
  'call-no-audio': 'The call’s tab was shared without its sound, so only your side is recorded. Stop, then share the tab with “Share tab audio” turned on.',
  'call-ended': 'Only the microphone is being recorded: sharing the call’s tab was cancelled or stopped.',
};

/** The controls, for the meeting's toolbar. */
const never = () => () => {};

export function RecordControl({ meeting }: { meeting: { id: string; title: string } }) {
  const rec = useRecording();
  const router = useRouter();
  // Known only in the browser: the server renders plain Record, and the browser settles it.
  const callAudio = useSyncExternalStore(never, () => recorderSupport().callAudio, () => false);

  const mine = rec.meetingId === meeting.id;

  if (rec.status !== 'idle' && !mine) {
    // A button that navigates, not a Button wrapping a Link (DS gotcha: asChild cannot wrap Link).
    return (
      <Button size="sm" variant="ghost" onClick={() => router.push(recordHref('meeting', rec.meetingId ?? '') ?? '/clients')}>
        Recording another meeting
      </Button>
    );
  }

  if (rec.status === 'starting') {
    return <Button size="sm" variant="secondary" loading>Starting</Button>;
  }

  if (rec.status === 'recording' || rec.status === 'paused') {
    const paused = rec.status === 'paused';
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-2 px-1.5 text-caption tabular-nums text-ink-700">
          <span aria-hidden className={cn('size-2 rounded-full', paused ? 'bg-ink-400' : 'bg-danger-500')} />
          {paused ? 'Paused' : formatStamp(rec.elapsed)}
          {!paused && <Levels />}
        </span>
        <Button size="sm" variant="ghost" icon={<Icon icon={paused ? Play : Pause} size={16} />} onClick={paused ? resumeRecording : pauseRecording}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="secondary" icon={<Icon icon={CircleStop} size={16} />} onClick={() => { void stopRecording(); }}>
          Stop
        </Button>
      </div>
    );
  }

  const start = (withCall: boolean) => {
    clearStartError();
    void startRecording(meeting, withCall);
  };

  return callAudio ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="primary" icon={<Icon icon={Mic} size={16} />}>Record</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Let everyone know the meeting is being transcribed.</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => start(true)} description="Your microphone and the call’s tab, as Me and Them">
          Record a call
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => start(false)} description="The microphone only, for a meeting in person">
          Record in the room
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button size="sm" variant="primary" icon={<Icon icon={Mic} size={16} />} onClick={() => start(false)}>Record</Button>
  );
}

/**
 * The recorder's one sentence, under the meeting's header: why it could not start, what it has
 * noticed about the sources, or what is holding up the transcript. Polite, so a screen reader hears
 * it without being interrupted, and nothing at all when there is nothing to say.
 */
export function RecordStatus({ meetingId }: { meetingId: string }) {
  const rec = useRecording();
  const text = rec.startError && (rec.meetingId === meetingId || rec.meetingId === null)
    ? START_ERRORS[rec.startError]
    : rec.meetingId === meetingId && rec.warning
      ? WARNINGS[rec.warning]
      : rec.problem
        ? TRANSCRIBE_MESSAGES[rec.problem]
        : null;
  return <div aria-live="polite">{text && <p className="mb-4 text-caption text-ink-600">{text}</p>}</div>;
}

/** One level per channel, drawn as the width of a short bar: seen, not read. */
function Levels() {
  const { me, them } = useRecordingLevels();
  const bar = (v: number) => `${Math.round(Math.min(1, Math.sqrt(v * 8)) * 100)}%`;
  return (
    <span aria-hidden className="flex w-8 flex-col gap-0.5">
      <span className="h-0.5 w-full overflow-hidden rounded-full bg-surface-fill">
        <span className="block h-full rounded-full bg-ink-500" style={{ width: bar(me) }} />
      </span>
      {them !== null && (
        <span className="h-0.5 w-full overflow-hidden rounded-full bg-surface-fill">
          <span className="block h-full rounded-full bg-ink-500" style={{ width: bar(them) }} />
        </span>
      )}
    </span>
  );
}
