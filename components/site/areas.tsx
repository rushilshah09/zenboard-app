'use client';
// ── THE FOUR PRODUCT AREAS ──────────────────────────────────────────────────
//
// Your day · Projects · Client portal · Money: each a Spotlight, each feature named the way the app
// names it and pictured with the product's own parts, on its own colours. Each picture is printed with a
// lobe of the mark rising from its outer bottom corner, its heavy side turned in toward the product, so
// down the page the lobes alternate sides with the pictures. A client module because a feature's picture is a function
// (it is told whether it is showing), and functions cannot cross from a server page into a client
// component.

/** A lobe from the outer bottom corner of a stage: right-hand stages, and (flipped) left-hand ones. */
const LOBE_RIGHT = { x: 1.1, y: 1.1, size: 1.5, turn: 0.5 };
const LOBE_LEFT = { x: -0.1, y: 1.1, size: 1.5, turn: -0.25 };
//
// Every feature listed here exists in the product today. Where a picture can be used — tick a task,
// switch a board, schedule, approve, record a payment, create an invoice — it is the real interaction,
// on sample data, saving nothing.

import * as React from 'react';
import {
  Calendar as CalendarIcon, Check, Clock, Download, FileText, Folder, Highlight, House, Kanban, Landmark,
  Lock, MessageCircle, Moon, Receipt, Sun, Timer, Users,
} from '@/components/ds/icons';
import { Badge, Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { BoardDemo, DocDemo, InvoiceDemo, TimeboxDemo } from './demos';
import { PortalView } from './portal-spotlight';
import {
  CapacitySnippet, ChatSnippet, CloseDaySnippet, ExportSnippet, FinanceSnippet, HighlightSnippet, PlanSnippet, Sheet,
  TimeToInvoice, WaitingSnippet,
} from './snippets';
import { Spotlight } from './spotlight';

export function DayArea() {
  return (
    <Spotlight
      id="day"
      field="day"
      hue="butter"
      icon={Sun}
      name="Your day"
      mark={LOBE_RIGHT}
      title="Know what matters before your first coffee."
      features={[
        { icon: House, title: 'Today, assembled for you', body: 'Home gathers what’s due, what you planned, your meetings and what’s waiting on others.', visual: () => <PlanSnippet /> },
        { icon: Highlight, title: 'One highlight a day', body: 'Pick the one task that matters. It leads the day until it’s done.', visual: () => <HighlightSnippet /> },
        { icon: Clock, title: 'A plan that fits your hours', body: 'Planning fits tasks around your meetings and moves what won’t fit to tomorrow.', visual: () => <CapacitySnippet /> },
        { icon: Moon, title: 'Close the day', body: 'Tick off what got done, carry the rest to tomorrow, and leave yourself a note.', visual: () => <CloseDaySnippet /> },
      ]}
    />
  );
}

export function ProjectsArea() {
  return (
    <Spotlight
      id="projects"
      field="projects"
      hue="sky"
      icon={Folder}
      name="Projects"
      mark={LOBE_LEFT}
      title="Every project carries its client and its next move."
      flip
      features={[
        { icon: Kanban, title: 'Boards and lists', body: 'The same tasks as a list or a board, grouped by the workstreams in the project.', visual: () => <Sheet inert={false} className="max-w-[36rem]"><BoardDemo /></Sheet> },
        { icon: CalendarIcon, title: 'Plan the week on your calendar', body: 'Put tasks beside your meetings. Google Calendar syncs both ways.', visual: () => <Sheet inert={false} className="max-w-[36rem]"><TimeboxDemo /></Sheet> },
        { icon: FileText, title: 'Briefs that link up', body: 'Documents link to the tasks and projects they are about.', visual: () => <Sheet inert={false} className="max-w-[36rem] sm:p-8"><DocDemo /></Sheet> },
        { icon: Users, title: 'Waiting on', body: 'Everything that is someone else’s move, kept off your plan until they make it.', visual: () => <WaitingSnippet /> },
      ]}
    />
  );
}

/** The client's side of their invoices, as the portal lists them. */
function PortalInvoices() {
  const rows = [
    { n: 'INV-021', what: 'Logo exploration and type', due: 'Due Oct 20', tone: 'info' as const, s: 'Sent', a: '$4,200' },
    { n: 'INV-018', what: 'Discovery workshop', due: 'Paid Sep 2', tone: 'success' as const, s: 'Paid', a: '$2,400' },
  ];
  return (
    <Sheet className="max-w-[32rem]">
      <p className="text-caption text-ink-500">Shared by Northlight Studio</p>
      <p className="mt-1 font-editorial text-title-3 text-ink-900">Invoices</p>
      <ul className="mt-4 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.n} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-line-soft')}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui text-ink-900"><span className="font-mono text-caption text-ink-500">{r.n}</span> · {r.what}</p>
              <p className="text-caption text-ink-500">{r.due}</p>
            </div>
            <Badge status={r.tone}>{r.s}</Badge>
            <span className="w-16 text-end tabular-nums font-medium text-ink-900">{r.a}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-caption text-ink-500"><Icon icon={Receipt} size={14} />Balance due · $4,200</p>
    </Sheet>
  );
}

export function PortalArea() {
  return (
    <Spotlight
      id="portal"
      field="portal"
      hue="apricot"
      icon={MessageCircle}
      name="Client portal"
      mark={LOBE_RIGHT}
      title="Give clients a page, not a thread of emails."
      features={[
        { icon: Check, title: 'Progress and approvals', body: 'Clients see how far along the work is, and approve what needs them.', visual: () => <div className="w-full max-w-[36rem]"><PortalView initialSide="client" /></div> },
        { icon: MessageCircle, title: 'A conversation per project', body: 'Messages with your client sit beside the work, not in your inbox.', visual: () => <ChatSnippet /> },
        { icon: Receipt, title: 'Invoices in the same place', body: 'Your client sees each invoice, what’s due and what’s been paid.', visual: () => <PortalInvoices /> },
        { icon: Lock, title: 'Nothing internal', body: 'Notes, hours and drafts stay on your side of the link. Switch sides to see.', visual: () => <div className="w-full max-w-[36rem]"><PortalView initialSide="you" /></div> },
      ]}
    />
  );
}

export function MoneyArea() {
  return (
    <Spotlight
      id="money"
      field="money"
      hue="sage"
      icon={Landmark}
      name="Money"
      mark={LOBE_LEFT}
      title="Know what’s owed, to the cent."
      flip
      features={[
        { icon: Timer, title: 'Invoices from tracked time', body: 'Time you log on a task becomes an invoice line in one step.', visual: () => <TimeToInvoice /> },
        { icon: Receipt, title: 'Payments as they arrive', body: 'Record a payment and the balance, the status and your client’s portal follow.', visual: () => <Sheet inert={false} className="max-w-[36rem] sm:p-8"><InvoiceDemo /></Sheet> },
        { icon: Landmark, title: 'What’s owed, at a glance', body: 'Outstanding, paid this month and overdue, across every client.', visual: () => <FinanceSnippet /> },
        { icon: Download, title: 'Ready for your accountant', body: 'Export invoices, their line items and payments as spreadsheets.', visual: () => <ExportSnippet /> },
      ]}
    />
  );
}
