'use client';
// Dev-only harness for the Clients hub — staged data so the memory-surface
// detail, pipeline board, and modals can be verified without a session.
// 404s in prod.
import { useEffect } from 'react';
import { notFound } from 'next/navigation';
import { ClientsView, type ClientCard, type Lead } from '@/components/clients/clients-view';
import { type FeedbackItem } from '@/components/feedback/feedback-board';
import { type MeetingItem } from '@/components/meetings/meeting-panel';
import { type MeetingTaskRow } from '@/lib/meeting-actions';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';
import { RecorderHost } from '@/components/meetings/recorder-host';
import { AskPanel } from '@/components/ask/ask-panel';
import type { AskAnswer } from '@/lib/actions/ask';
import type { TranscriptSegment } from '@/lib/meeting-transcript';
import { NOTES_MESSAGES, type MeetingNotes } from '@/lib/meeting-notes';
import { stubServerActions } from '../action-stub';

const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const CLIENTS: ClientCard[] = [
  {
    id: 'c1', name: 'Meridian Studio', role: 'Head of Brand', contact: 'Sarah Chen', email: 'sarah@meridian.co',
    status: 'active', health: 'good', since: 'Mar 2025', next_step: 'Send the Q3 retainer proposal', created_at: day(140),
    notes: [
      { id: 'n1', client_id: 'c1', body: 'Kickoff call — they want the rebrand live before the September launch.', created_at: day(2) },
      { id: 'n2', client_id: 'c1', body: 'Logged a touch.', created_at: day(9) },
    ],
    projects: [
      { id: 'p1', name: 'Brand identity', color: '#9A1B6F', client_id: 'c1', status: 'active', open: 5, total: 12 },
      // Finished, so the one-live-project rule still has a single answer here.
      { id: 'p2', name: 'Website rebuild', color: '#2B5CB0', client_id: 'c1', status: 'completed', open: 3, total: 8 },
    ],
    invoices: [
      { id: 'i1', number: 'INV-014', client_id: 'c1', status: 'paid', amount: 4200 },
      { id: 'i2', number: 'INV-018', client_id: 'c1', status: 'sent', amount: 2800 },
    ],
    forms: [
      { id: 'fm1', title: 'Project kickoff brief', status: 'live', shareToken: 'demoTokenForPreview123', updatedAt: day(1), responses: 12, partials: 3 },
      { id: 'fm2', title: 'Testimonial request', status: 'draft', shareToken: null, updatedAt: day(9), responses: 0, partials: 0 },
    ],
  },
  {
    id: 'c2', name: 'Fernwood Hotels', role: null, contact: 'Marco Diaz', email: null,
    status: 'active', health: 'attention', since: null, next_step: null, created_at: day(60),
    notes: [], projects: [], invoices: [{ id: 'i3', number: 'INV-020', client_id: 'c2', status: 'overdue', amount: 1500 }], forms: [],
  },
  {
    id: 'c3', name: 'Atlas Coffee', role: 'Founder', contact: 'Priya Raman', email: 'priya@atlas.coffee',
    status: 'past', health: 'good', since: 'Jan 2024', next_step: null, created_at: day(400),
    notes: [{ id: 'n3', client_id: 'c3', body: 'Wrapped the packaging project. Great to work with.', created_at: day(120) }],
    projects: [{ id: 'p3', name: 'Packaging', color: '#C88A3B', client_id: 'c3', status: 'completed', open: 0, total: 6 }],
    invoices: [{ id: 'i4', number: 'INV-009', client_id: 'c3', status: 'paid', amount: 3600 }], forms: [],
  },
];

const LEADS: Lead[] = [
  { id: 'l1', name: 'Northwind Ltd', contact: 'Dana Wu', value: 8000, stage: 'lead', source: 'Referral', note: 'Warm intro from Sarah.', created_at: day(3) },
  { id: 'l2', name: 'Coastal Realty', contact: 'Sam Poole', value: 5000, stage: 'contacted', source: 'Website', note: null, created_at: day(6) },
  { id: 'l3', name: 'Brightline', contact: 'Jo Park', value: 12000, stage: 'proposal', source: 'Referral', note: 'Proposal sent Tuesday.', created_at: day(10) },
];

const D = (ids: string[]) => LEADS.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, name: l.name, value: l.value }));
// The transcript is staged so every state of the Action items list is on screen
// at once: a promoted item that is done, a promoted item in Inbox, a line still
// waiting, a line ticked in the notes but never made a task, prose that must NOT
// be mistaken for a commitment, and (via MEETING_TASKS) a task whose line has
// been edited away.
const M1_NOTES = [
  'Sarah walked through the September launch. Wants the rebrand live before then.',
  '',
  '[ ] Send the revised colour palette',
  '[ ] Book the photographer for the launch shoot',
  '[x] Share the Q3 invoice schedule',
  'I will follow up about the pricing tier — she wants usage-based.',
  '- [ ] Draft the launch announcement copy',
].join('\n');

// A raw transcript with no action lines yet: what "Find action items" is for. The suggestions the
// stub below returns quote it, the way the server's verifier requires.
const M3_NOTES = [
  'Call with Meridian Studio — brand refresh kickoff',
  'Sarah: We loved the moodboard, but the green feels too corporate.',
  'Me: Got it. I’ll send two alternative palettes by Thursday, one warmer and one earthier.',
  'Sarah: Great. Also, can the logo work on our cups? The cup print is tiny.',
  'Me: Good point — I’ll do a small-size test of the mark on the cup template.',
  'Sarah: We still owe you the old brand files, I’ll ask Dev to send them tomorrow.',
  'Sarah: Could you also quote for a menu board redesign? Not urgent.',
  'Me: Sure, I’ll put together a quote for the menu board next week.',
].join('\n');

const MEETINGS: MeetingItem[] = [
  { id: 'm1', client_id: 'c1', title: 'Q3 planning call', notes: M1_NOTES, met_at: day(1), created_at: day(1) },
  { id: 'm3', client_id: 'c1', title: 'Brand refresh kickoff', notes: M3_NOTES, met_at: day(0), created_at: day(0) },
  { id: 'm2', client_id: 'c1', title: 'Kickoff', notes: null, met_at: day(9), created_at: day(9) },
];

// The write-up for M3_NOTES (MEETINGS_PLAN.md M2). Every line is quoted from those notes, exactly
// as `verifyNotes` would require of a real one — a harness that stages an unquotable line would
// preview a state the product cannot reach.
const WRITTEN: MeetingNotes = {
  v: 1,
  kind: 'kickoff',
  summary: 'We went through the moodboard for the brand refresh. The green reads too corporate, so two alternative palettes are coming by Thursday, and the launch moves to March 3rd.',
  details: [
    { key: 'launch on march 3rd', label: 'Deadline', text: 'Launch on March 3rd', evidence: 'Yes, March 3rd.' },
  ],
  decisions: [
    { key: 'the launch moves to march 3rd', text: 'The launch moves to March 3rd', evidence: 'And we agreed the launch moves to March 3rd, right?' },
  ],
  mine: [
    { key: 'send two alternative palettes by thursday', text: 'Send two alternative palettes by Thursday', evidence: 'I’ll send two alternative palettes by Thursday, one warmer and one earthier.' },
    { key: 'test the mark at small size on the cup template', text: 'Test the mark at small size on the cup template', evidence: 'I’ll do a small-size test of the mark on the cup template.' },
    { key: 'send the menu board redesign quote next week', text: 'Send the menu board redesign quote next week', evidence: 'Sure, I’ll put together a quote for the menu board next week.' },
  ],
  theirs: [
    { key: 'send the old brand files tomorrow', text: 'Send the old brand files tomorrow', evidence: 'We still owe you the old brand files, I’ll ask Dev to send them tomorrow.' },
  ],
  asks: [
    { key: 'quote for a menu board redesign', text: 'Quote for a menu board redesign', evidence: 'Could you also quote for a menu board redesign? Not urgent.' },
  ],
  questions: [],
  dismissed: [],
  truncated: false,
  at: new Date().toISOString(),
};

const EMPTY: MeetingNotes = {
  ...WRITTEN, summary: '', details: [], decisions: [], mine: [], theirs: [], asks: [], questions: [],
};

// `?ai=` picks what the clerk answers, so every state of the write-up can be seen:
// ok (default) · long · empty · limit · unavailable · slow · offline · unkept (0047 not applied).
function suggestAnswer(mode: string): Promise<unknown> {
  const after = (ms: number, v: unknown) => new Promise((r) => setTimeout(() => r(v), ms));
  switch (mode) {
    case 'empty': return after(900, { notes: EMPTY, kept: true });
    case 'long': return after(900, { notes: { ...WRITTEN, truncated: true }, kept: true });
    case 'unkept': return after(900, { notes: WRITTEN, kept: false });
    case 'limit': return after(300, { error: NOTES_MESSAGES.limit, reason: 'limit' });
    case 'unavailable': return after(900, { error: NOTES_MESSAGES.unavailable, reason: 'unavailable' });
    case 'slow': return after(6000, { notes: WRITTEN, kept: true });
    case 'offline': return new Promise((_, reject) => setTimeout(() => reject(new TypeError('Failed to fetch')), 300));
    default: return after(1200, { notes: WRITTEN, kept: true });
  }
}

// `?transcript=demo`: the kickoff (m3) has a saved recording — long enough that the transcript
// scrolls, so an answer's receipt (`&t=271`) has somewhere to scroll TO. The lines that matter sit
// among small talk, the way they do in a real call.
const said = (start: number, speaker: 'me' | 'them', text: string, i: number): TranscriptSegment =>
  ({ id: `d${i}`, start, end: start + 5, speaker, text });
const DEMO_TRANSCRIPT: TranscriptSegment[] = [
  [0, 'me', 'Thanks for making the time, Sarah.'],
  [6, 'them', 'Of course. We loved the moodboard, but the green feels too corporate.'],
  [14, 'me', 'Got it. I’ll send two alternative palettes by Thursday, one warmer and one earthier.'],
  ...Array.from({ length: 24 }, (_, k) => [30 + k * 9, k % 2 ? 'them' : 'me', k % 2 ? 'That makes sense for the rollout.' : 'Let me note that down for the team.'] as const),
  [271, 'them', 'For the budget, we have about eight thousand for this phase.'],
  [280, 'me', 'Understood, I will keep the palettes and the cup test inside that.'],
  ...Array.from({ length: 14 }, (_, k) => [290 + k * 8, k % 2 ? 'me' : 'them', k % 2 ? 'Sounds good.' : 'We can pick that up next week.'] as const),
  [420, 'them', 'Could you also quote for a menu board redesign? Not urgent.'],
].map(([start, speaker, text], i) => said(start as number, speaker as 'me' | 'them', text as string, i));

// What Ask answers about the kickoff, staged the way `lib/actions/ask.ts` would draw it: receipts
// as whole sentences with who said them and when, each opening THIS harness at its moment.
const HERE = (t?: number) => `/dev-preview/clients?transcript=demo&meeting=m3${t === undefined ? '' : `&t=${t}`}`;
const ASKED: { match: RegExp; answer: AskAnswer }[] = [
  {
    match: /budget/i,
    answer: {
      kind: 'quoted', partial: false,
      text: 'Meridian has about eight thousand for this phase, and you said you would keep the palettes and the cup test inside that.',
      quotes: [
        { text: 'For the budget, we have about eight thousand for this phase.', source: 'Them · 4:31', href: HERE(271) },
        { text: 'Understood, I will keep the palettes and the cup test inside that.', source: 'Me · 4:40', href: HERE(280) },
      ],
      record: { type: 'meeting', id: 'm3', label: 'Brand refresh kickoff', href: HERE() },
    },
  },
  {
    match: /promise|action items/i,
    answer: {
      kind: 'quoted', partial: true,
      text: '- Send two alternative palettes by Thursday\n- Put together a quote for the menu board next week',
      quotes: [
        { text: 'Got it. I’ll send two alternative palettes by Thursday, one warmer and one earthier.', source: 'Me · 0:14', href: HERE(14) },
        { text: 'Me: Sure, I’ll put together a quote for the menu board next week.', source: 'Your notes', href: HERE() },
      ],
      record: { type: 'meeting', id: 'm3', label: 'Brand refresh kickoff', href: HERE() },
    },
  },
  {
    match: /pricing|invoice/i,
    answer: { kind: 'quoted', partial: false, text: 'That did not come up in this meeting.', quotes: [], record: { type: 'meeting', id: 'm3', label: 'Brand refresh kickoff', href: HERE() } },
  },
];

const MEETING_TASKS: MeetingTaskRow[] = [
  { meetingId: 'm1', taskId: 'mt1', title: 'Send the revised colour palette', done: true, projectId: 'p1' },
  { meetingId: 'm1', taskId: 'mt2', title: 'Book the photographer for the launch shoot', done: false, projectId: null },
  // Its line was edited after promotion — kept, and labelled.
  { meetingId: 'm1', taskId: 'mt3', title: 'Confirm the print run with the supplier', done: false, projectId: 'p1' },
];

const FEEDBACK: FeedbackItem[] = [
  { id: 'f1', number: 34, title: 'Add usage-based pricing', body: null, status: 'open', source: 'meeting', client_id: 'c1', meeting_id: 'm1', task_id: null, created_at: day(1), deals: D(['l3', 'l2']) },
  { id: 'f2', number: 33, title: 'Bulk CSV import for contacts', body: null, status: 'open', source: 'client', client_id: null, meeting_id: null, task_id: null, created_at: day(4), deals: D(['l1']) },
  { id: 'f3', number: 31, title: 'Slack alerts on deal stage change', body: null, status: 'planned', source: 'meeting', client_id: null, meeting_id: null, task_id: null, created_at: day(8), deals: D(['l3']) },
  { id: 'f4', number: 28, title: 'Dark mode', body: null, status: 'open', source: 'portal', client_id: null, meeting_id: null, task_id: null, created_at: day(12), deals: [] },
  { id: 'f5', number: 25, title: 'Recurring invoices', body: null, status: 'in_progress', source: 'meeting', client_id: 'c1', meeting_id: 'm1', task_id: 't1', created_at: day(15), deals: D(['l2']) },
  { id: 'f6', number: 22, title: 'Two-way calendar sync', body: null, status: 'shipped', source: 'meeting', client_id: 'c1', meeting_id: null, task_id: 't2', created_at: day(30), deals: D(['l1']) },
];

export default function ClientsPreviewPage() {
  // Answer the meeting panel's actions so its success paths can be seen without a session: the
  // clerk's suggestions, the notes save an Add triggers, and the feedback item an ask becomes.
  // Everything else still throws, as the ActionFailureNet below expects.
  useEffect(() => {
    let n = 0;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('ai') ?? 'ok';
    const unstub = stubServerActions((args) => {
      const [a, b] = args;
      // `ask(message, ref)` from the Ask panel — a sentence, then the open record's address. The
      // address is null HERE: Ask recognises `/clients?meeting=<uuid>`, and this page is
      // `/dev-preview/clients` with an id of `m3` (the real round trip is proven in
      // lib/meeting-ask.test.ts). The script answers either way.
      if (typeof a === 'string' && args.length === 2 && (b === null || (b && typeof b === 'object' && 'type' in b && 'id' in b))) {
        const found = ASKED.find((x) => x.match.test(a))?.answer;
        return new Promise((r) => setTimeout(() => r(found ?? { kind: 'said', text: 'Ask me about the budget, what you promised, or pricing.' }), 700));
      }
      if (typeof a === 'string' && typeof b === 'string' && b.includes('\n')) return suggestAnswer(mode);
      // "Not this one", and removing the write-up: both answer with the same acknowledgement.
      if (typeof a === 'string' && typeof b === 'string' && /^(mine|asks|theirs):/.test(b)) return { ok: true };
      if (typeof a === 'string' && b && typeof b === 'object' && 'notes' in b) return { ok: true };
      // The recorded transcript: none saved yet, and every save kept where a check can read it.
      if (typeof a === 'string' && b && typeof b === 'object' && 'segments' in b) {
        (window as unknown as { __savedTranscript?: unknown }).__savedTranscript = b;
        return { ok: true };
      }
      // `loadMeetingTranscript`, `loadMeetingWriteUp` and `clearMeetingWriteUp` all take one id and
      // the stub matches on SHAPE, so it cannot tell them apart. One object satisfying all three is
      // the honest answer here — nothing is kept in a harness, which is exactly what each reports.
      if (typeof a === 'string' && args.length === 1) {
        const transcript = params.get('transcript') === 'demo' && a === 'm3'
          ? { segments: DEMO_TRANSCRIPT, language: 'en', duration: 440 }
          : null;
        return { supported: true, transcript, notes: null, ok: true };
      }
      if (a && typeof a === 'object' && 'title' in a && 'meetingId' in a) { n += 1; return { id: `fb-new-${n}`, number: 40 + n }; }
      return undefined;
    });

    // Pieces of a recording go to the dev-only route, which transcribes them with the REAL Whisper
    // but needs no session (app/dev-preview/transcribe/route.dev.tsx).
    const realFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!/\/api\/meetings\/[^/]+\/transcribe$/.test(url)) return realFetch(input, init);
      // `?transcribe=down`: transcription is busy, so pieces wait on the device and retry.
      if (params.get('transcribe') === 'down') return Promise.resolve(Response.json({ reason: 'unavailable' }, { status: 503 }));
      return realFetch('/dev-preview/transcribe', init);
    };

    // `?fakemic=1`: the two-voice test conversation stands in for the devices — its left channel is
    // the microphone (the note-taker), its right channel the shared call (the client) — so the whole
    // recorder can be driven by a click and checked against a known script.
    const media = navigator.mediaDevices;
    const real = { user: media?.getUserMedia?.bind(media), display: media?.getDisplayMedia?.bind(media) };
    // `?fakemic=denied`: the person says no to the microphone.
    if (params.get('fakemic') === 'denied' && media) {
      media.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
      media.getDisplayMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
    }
    if (params.get('fakemic') === '1' && media) {
      let streams: Promise<{ mic: MediaStream; call: MediaStream }> | null = null;
      const open = () => (streams ??= (async () => {
        const ctx = new AudioContext();
        const clip = await ctx.decodeAudioData(await (await realFetch('/dev-preview/transcribe')).arrayBuffer());
        const source = ctx.createBufferSource();
        source.buffer = clip;
        const split = ctx.createChannelSplitter(2);
        const mic = ctx.createMediaStreamDestination();
        const call = ctx.createMediaStreamDestination();
        source.connect(split);
        split.connect(mic, 0);
        split.connect(call, 1);
        source.start();
        (window as unknown as { __clipSeconds?: number }).__clipSeconds = clip.duration;
        return { mic: mic.stream, call: call.stream };
      })());
      media.getUserMedia = async () => (await open()).mic;
      media.getDisplayMedia = async () => (await open()).call;
    }
    return () => {
      // Unwound in reverse: this wrapper sits on top of the action stub.
      window.fetch = realFetch;
      unstub();
      if (media && real.user) media.getUserMedia = real.user;
      if (media && real.display) media.getDisplayMedia = real.display;
    };
  }, []);
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)' }}>
      <ClientsView
        initialClients={CLIENTS} initialLeads={LEADS} initialFeedback={FEEDBACK}
        initialMeetings={MEETINGS} initialMeetingTasks={MEETING_TASKS} meetingTasksSupported
      />
      {/* Its own <Toaster/>: dev-preview renders OUTSIDE AppShell, which owns the
          app's single one. Without it every toast this harness raises is
          invisible — including the one that says an optimistic edit was refused
          and put back, which is the ONLY report that failure ever gets. */}
      <Toaster />
      {/* And the shell's net: dev-preview has no session, so EVERY action here
          throws — without this the harness silently keeps edits that failed. */}
      <ActionFailureNet />
      {/* And the recorder's host, which the shell mounts once: it finishes pieces a reloaded page
          left on the device, and asks before a reload would end a recording. */}
      <RecorderHost />
      {/* And Ask, which the shell also mounts once: the meeting page's Ask button opens it. */}
      <AskPanel />
    </div>
  );
}
