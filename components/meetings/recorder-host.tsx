'use client';
// The recorder's place in the shell — mounted ONCE (components/shell/app-shell.tsx), beside the
// focus timer, so a meeting keeps recording while you move around the app.
//
// It renders two things and does four:
//   · holds this tab's liveness lock, and adopts pieces a closed tab left on the device;
//   · retries what was waiting on the network the moment the network is back;
//   · saves any transcript still waiting to be saved when the page is hidden;
//   · asks before a reload or close would end a recording in progress (the browser's own dialog —
//     its wording cannot be changed, and it is the only thing that can stop a closing tab);
//   · <RecordingIndicator>: while recording, a quiet pill in the top bar that says so, for how long,
//     and takes you back to the meeting.
import { useEffect } from 'react';
import NextLink from 'next/link';

import { Tooltip } from '@/components/ds/ui';
import { recordHref } from '@/lib/connected';
import { formatStamp } from '@/lib/meeting-transcript';
import {
  adoptLeftovers, flushSaves, holdOwnership, isRecordingActive, onReconnect, useRecording,
} from '@/components/meetings/recording';

export function RecorderHost() {
  useEffect(() => {
    holdOwnership();
    void adoptLeftovers();
    const online = () => onReconnect();
    const hidden = () => { if (document.visibilityState === 'hidden') flushSaves(); };
    const leaving = (e: BeforeUnloadEvent) => {
      flushSaves();
      if (isRecordingActive()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('beforeunload', leaving);
    return () => {
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('beforeunload', leaving);
    };
  }, []);
  return null;
}

/**
 * While a meeting records: a dot, the time, and the way back. A dot rather than a pulsing light —
 * this sits in the top bar for an hour at a time, and nothing seen that long gets more than a wash.
 */
export function RecordingIndicator() {
  const r = useRecording();
  if ((r.status !== 'recording' && r.status !== 'paused') || !r.meetingId) return null;
  const paused = r.status === 'paused';
  return (
    <Tooltip content={`${paused ? 'Paused' : 'Recording'} · ${r.title || 'Meeting'}`}>
      <NextLink
        href={recordHref('meeting', r.meetingId) ?? '/clients'}
        aria-label={`${paused ? 'Recording paused' : 'Recording'}: ${r.title || 'meeting'}, ${formatStamp(r.elapsed)}. Open the meeting.`}
        className="zb-nav-item zb-press focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-2 text-caption tabular-nums text-ink-700"
      >
        <span aria-hidden className={paused ? 'size-2 rounded-full bg-ink-400' : 'size-2 rounded-full bg-danger-500'} />
        {formatStamp(r.elapsed)}
      </NextLink>
    </Tooltip>
  );
}
