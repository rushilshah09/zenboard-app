'use client';
// ── ONE PROJECT, TWO SIDES ──────────────────────────────────────────────────
//
// The client portal's whole promise in one control: switch between what YOU see of a project and what
// your CLIENT sees of the same project. Your side carries things marked Internal — a note, the hours,
// the draft — and on theirs those things are simply not there.
//
// It is one project, not two pictures: approve the presentation as the client, switch back, and your
// side says it was approved. That is the connected system the rest of the page describes, working.

import * as React from 'react';
import { Check, Lock, MessageCircle, Receipt } from '@/components/ds/icons';
import { Avatar, Badge, Button, Icon, Progress, SegmentedControl, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export type Side = 'you' | 'client';

export function PortalView({ initialSide = 'client' }: { initialSide?: Side }) {
  const [side, setSide] = React.useState<Side>(initialSide);
  const [approved, setApproved] = React.useState(false);

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        aria-label="Whose view"
        className="self-start"
        fit="content"
        value={side}
        onValueChange={(v) => setSide(v as Side)}
        options={[{ value: 'you', label: 'What you see' }, { value: 'client', label: 'What Ridgeline sees' }]}
      />

      <div>
        {/* Keyed on the side, so switching reads as turning the page over rather than rows blinking. */}
        <div key={side} className={cardClass('site-swap zb-enter site-glass w-full rounded-xl p-6 sm:p-8')}>
          <p className="text-caption text-ink-500">{side === 'client' ? 'Shared by Northlight Studio' : 'Project · Ridgeline'}</p>
          <p className="mt-1 font-editorial text-title-1 text-ink-900">Ridgeline rebrand</p>

          <div className="mt-5">
            <Progress value={72} size="sm" valueText="72% of the work is done" />
            <p className="mt-1.5 text-caption text-ink-500">72% done · due Nov 14</p>
          </div>

          <ul className="mt-6 flex flex-col divide-y divide-line-soft border-y border-line-soft">
            <Row
              icon={<Icon icon={Check} size={16} className="text-ink-500" />}
              title="Logo presentation"
              meta={approved ? 'Approved by Priya' : 'Waiting for Ridgeline to approve'}
              end={
                approved ? (
                  <Badge status="success">Approved</Badge>
                ) : side === 'client' ? (
                  <Button size="xs" variant="secondary" onClick={() => setApproved(true)}>Approve</Button>
                ) : (
                  <Badge status="warning">Awaiting client</Badge>
                )
              }
            />
            <Row icon={<Icon icon={Receipt} size={16} className="text-ink-500" />} title="Invoice INV-021" meta="Due Oct 20" end={<span className="text-ui tabular-nums font-medium text-ink-900">$4,200</span>} />
            {side === 'you' && (
              <>
                <Row internal icon={<Icon icon={Lock} size={16} className="text-ink-500" />} title="Keep it to three routes, the budget is tight" meta="Your note" />
                <Row internal icon={<Icon icon={Lock} size={16} className="text-ink-500" />} title="38h 20m tracked" meta="4h 10m not billed yet" />
              </>
            )}
            <Row
              icon={<Avatar name="Alex Morgan" size="sm" decorative />}
              title="The routes are up. Route B is my pick."
              meta="Alex · in the project conversation"
              end={<Icon icon={MessageCircle} size={16} className="text-ink-500" />}
            />
          </ul>

          {side === 'client' && (
            <p className="mt-4 text-caption text-ink-500">Nothing internal is here: no notes, no hours, no drafts.</p>
          )}
          {side === 'you' && approved && (
            <p className="site-swap zb-enter mt-4 text-caption text-ink-500">Priya approved it from her portal. Your task moved on without an email.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, title, meta, end, internal }: { icon: React.ReactNode; title: string; meta: string; end?: React.ReactNode; internal?: boolean }) {
  return (
    <li className="flex min-h-[3.25rem] items-center gap-3 py-2.5">
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-ui', internal ? 'text-ink-700' : 'text-ink-900')}>{title}</p>
        <p className="truncate text-caption text-ink-500">{meta}</p>
      </div>
      {internal && <Badge status="neutral">Internal</Badge>}
      {end}
    </li>
  );
}
