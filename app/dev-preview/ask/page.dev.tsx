'use client';
// Dev-only harness for Ask — the REAL `<AskPanel/>`, with the server answering from a script, so
// the drawer, the empty state, every kind of answer, the offer's accept and dismiss, the "which
// one?" question, ticking a task inside a turn, and the composer's keyboard can all be verified
// without a session and without spending a model call. 404s in prod (see ../layout.tsx).
//
// The panel is the real one on purpose: a harness that re-implemented the turn loop would verify
// the harness. `stubServerActions` answers on the wire instead (app/dev-preview/action-stub.ts),
// which is why `ask` below is matched by its ARGUMENTS — a harness cannot see which action was
// called, only what it was passed, and every action here has a distinguishable shape.
import { useEffect, useState } from 'react';

import { AskHome } from '@/components/ask/ask-home';
import { AskPanel, openAsk } from '@/components/ask/ask-panel';
import { Button, Toaster, cardClass } from '@/components/ds/ui';
import { stubServerActions } from '@/app/dev-preview/action-stub';
import type { AskAnswer } from '@/lib/actions/ask';

const task = (id: string, title: string, done = false, priority: 'low' | 'med' | 'high' = 'low', estimate: number | null = null) =>
  ({ id, title, done, priority, highlight: false, estimate_minutes: estimate });

// The reasoning the real action attaches to every answer (`traceFor`, lib/actions/ask.ts). Staged
// here so the thinking disclosure can be verified without a model call — and staged on ONE answer
// rather than all of them, so the "no trace, no disclosure" path is on screen at the same time.
const TRACE = [
  { label: 'Read it as', detail: 'Tick off Buildojo logo v2' },
  { label: 'Took the subject to be', detail: 'the logo one' },
];

const ANSWERS: { match: RegExp; answer: AskAnswer & { trace?: { label: string; detail: string }[] } }[] = [
  {
    match: /which one|two logos|ambiguous/i,
    answer: {
      kind: 'choose', text: 'Which one?', then: 'complete_task', when: null,
      options: [{ id: 't1', label: 'Buildojo logo v2' }, { id: 't2', label: 'Buildojo logo v3' }],
    },
  },
  {
    match: /tick|complete|done/i,
    answer: { kind: 'offer', text: 'Tick off Buildojo logo v2', proposal: { do: 'complete_task', id: 't1', label: 'Buildojo logo v2' }, trace: TRACE },
  },
  {
    match: /move|reschedule|friday/i,
    answer: { kind: 'offer', text: 'Move Buildojo logo v2 to Fri 2 Oct', proposal: { do: 'reschedule_task', id: 't1', label: 'Buildojo logo v2', day: '2026-10-02', dayLabel: 'Fri 2 Oct' } },
  },
  {
    match: /remind/i,
    answer: { kind: 'offer', text: 'Remind you about Northwind invoice on Mon 5 Oct at 09:00', proposal: { do: 'create_reminder', id: 't3', label: 'Northwind invoice', at: '2026-10-05T08:00:00.000Z', atLabel: 'Mon 5 Oct at 09:00' } },
  },
  {
    match: /today|my tasks|what am i/i,
    answer: {
      kind: 'tasks', text: '3 open today.', day: '2026-09-28',
      tasks: [
        { ...task('t1', 'Buildojo logo v2', false, 'high', 90), project: { name: 'Brand refresh', color: '#B4166B' } },
        { ...task('t3', 'Northwind invoice', false, 'med', 20), project: null },
        { ...task('t4', 'Send the darker palette', false, 'low', 45), project: { name: 'Brand refresh', color: '#B4166B' } },
        { ...task('t5', 'Book the screen install', true, 'low', null), project: null },
      ],
    },
  },
  {
    match: /calendar|agenda|meetings/i,
    answer: {
      kind: 'agenda', text: '3 on Today.', day: '2026-09-28',
      events: [
        { id: 'e1', title: 'Meridian Coffee, brand review', startsAt: '2026-09-28T09:00:00.000Z', endsAt: '2026-09-28T09:30:00.000Z', allDay: false, clock: '10:00' },
        { id: 'e2', title: 'Studio admin block', startsAt: '2026-09-28T13:00:00.000Z', endsAt: '2026-09-28T14:00:00.000Z', allDay: false, clock: '14:00' },
        { id: 'e3', title: 'Invoice run', startsAt: '2026-09-28T00:00:00.000Z', endsAt: null, allDay: true },
      ],
    },
  },
  {
    match: /find|search|northwind/i,
    answer: {
      kind: 'found', text: '3 for "northwind".',
      hits: [
        { type: 'client', id: 'c1', label: 'Northwind Coffee', href: '/clients?c=c1' },
        { type: 'invoice', id: 'i1', label: 'INV-0042', href: '/money/i1' },
        { type: 'project', id: 'p1', label: 'Northwind packaging', href: '/projects/p1' },
      ],
    },
  },
  {
    // Asked with no meeting open and none named: Ask offers the latest few, each with its day.
    match: /which meeting|meeting about/i,
    answer: {
      kind: 'choose', text: 'Which meeting?', then: 'ask_meeting', when: null, question: 'What did they say about the budget?',
      options: [
        { id: 'm3', label: 'Brand refresh kickoff · Meridian Studio', hint: 'Today' },
        { id: 'm1', label: 'Q3 planning call · Meridian Studio', hint: 'Yesterday' },
        { id: 'm2', label: 'Kickoff · Fernwood Hotels', hint: '20 Sep' },
      ],
    },
  },
  {
    match: /budget|decide|promise/i,
    answer: {
      kind: 'quoted', partial: false,
      text: 'Meridian has about eight thousand for this phase, and you said you would keep the palettes and the cup test inside that.',
      quotes: [
        { text: 'For the budget, we have about eight thousand for this phase.', source: 'Them · 4:31', href: '/dev-preview/clients?transcript=demo&meeting=m3&t=271' },
        { text: 'Understood, I will keep the palettes and the cup test inside that.', source: 'Me · 4:40', href: '/dev-preview/clients?transcript=demo&meeting=m3&t=280' },
      ],
      record: { type: 'meeting', id: 'm3', label: 'Brand refresh kickoff', href: '/dev-preview/clients?transcript=demo&meeting=m3' },
    },
  },
  { match: /add|create|new task/i, answer: { kind: 'did', text: 'Added Finish the Buildojo logo, on Fri 2 Oct.', record: { type: 'task', id: 't9', label: 'Finish the Buildojo logo', href: '/tasks?task=t9' } } },
  { match: /email|inbox/i, answer: { kind: 'said', text: 'I cannot read your email yet.' } },
  { match: /limit|allowance/i, answer: { kind: 'error', text: 'That is all the AI for today. Everything else in Zenboard still works, and this resets tomorrow.' } },
];

const FALLBACK: AskAnswer = { kind: 'said', text: 'I can add and move tasks, put things on your calendar, set reminders, start projects, and find what you already have. That one I cannot do yet.' };

export default function AskHarness() {
  const [latency, setLatency] = useState(600);
  const [showHome, setShowHome] = useState(false);

  useEffect(() => stubServerActions(async (args) => {
    // `ask(message, ref)` — a string first. Everything else here is an id or a proposal object.
    if (typeof args[0] === 'string') {
      const message = args[0];
      await new Promise((r) => setTimeout(r, latency));
      // `chooseAndRun(id, then, when)` also leads with a string, and is told apart by its second
      // argument being one of the three proposal verbs.
      if (typeof args[1] === 'string') {
        // Choosing a meeting answers the question that was carried with the choice.
        if (args[1] === 'ask_meeting') return ANSWERS.find((a) => a.answer.kind === 'quoted')!.answer;
        return { kind: 'did', text: `Ticked off ${args[0] === 't1' ? 'Buildojo logo v2' : 'Buildojo logo v3'}.`, record: { type: 'task', id: String(args[0]), label: 'Buildojo logo v2', href: `/tasks?task=${args[0]}` } } satisfies AskAnswer;
      }
      return ANSWERS.find((a) => a.match.test(message))?.answer ?? FALLBACK;
    }
    // `runProposal(proposal)`
    const p = args[0] as { do?: string; label?: string; id?: string; dayLabel?: string; atLabel?: string } | null;
    if (p && typeof p === 'object' && p.do) {
      await new Promise((r) => setTimeout(r, latency));
      const record = { type: 'task' as const, id: String(p.id), label: String(p.label), href: `/tasks?task=${p.id}` };
      if (p.do === 'complete_task') return { kind: 'did', text: `Ticked off ${p.label}.`, record } satisfies AskAnswer;
      if (p.do === 'reschedule_task') return { kind: 'did', text: `Moved ${p.label} to ${p.dayLabel}.`, record } satisfies AskAnswer;
      return { kind: 'did', text: `I will remind you about ${p.label} on ${p.atLabel}.`, record } satisfies AskAnswer;
    }
    // `toggleTask(id, done)` — a task ticked inside an answer. Succeeds, so the row stays flipped.
    return { ok: true };
  }), [latency]);

  return (
    <div className="min-h-dvh bg-surface-desk p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-title-2 text-ink-900">Ask, staged</h1>
        <p className="text-ui text-ink-600">
          The real panel, answered from a script. Try: <em>what am I doing today</em> · <em>move the logo to Friday</em> ·
          {' '}<em>tick off the logo</em> · <em>which one</em> · <em>remind me about the invoice</em> · <em>find northwind</em> ·
          {' '}<em>what is on my calendar</em> · <em>find my emails</em> · <em>limit</em>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => openAsk()}>Open Ask</Button>
          <Button onClick={() => openAsk('What am I doing today?')}>Open with a question</Button>
          <Button onClick={() => setLatency((l) => (l === 600 ? 4000 : 600))}>{latency === 600 ? 'Slow answers' : 'Normal answers'}</Button>
          <Button onClick={() => setShowHome((h) => !h)}>{showHome ? 'Hide Home mode' : 'Show Home mode'}</Button>
        </div>
        {/* Home's Ask mode, beside the panel — the point being that they share ONE store, so a
            question asked in either appears in both. Verifying the claim, not restating it. */}
        {showHome && <div className={cardClass('p-4')}><AskHome /></div>}
      </div>
      <AskPanel />
      <Toaster />
    </div>
  );
}
