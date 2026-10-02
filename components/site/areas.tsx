'use client';
// ── THE PRODUCT AREAS ───────────────────────────────────────────────────────
//
// Your day · Projects · Finance: each a Spotlight, each feature named the way the app names it and
// pictured as a screen of the product (snippets.tsx `Screen`), on its chapter's colours. The client
// portal is not one of these any more: it has a section of its own (portal-section.tsx).
//
// Each picture is printed with a lobe of the mark rising from its outer bottom corner, its heavy side
// turned in toward the product, so down the page the lobes alternate sides with the pictures. A client
// module because a feature's picture is a function (it is told whether it is showing), and functions
// cannot cross from a server page into a client component.
//
// Every feature listed here exists in the product today. Where a picture can be used (tick a task,
// switch a board, schedule, record a payment, create an invoice) it is the real interaction, on sample
// data, saving nothing.

import * as React from 'react';
import {
  Calendar as CalendarIcon, Clock, Download, FileText, Folder, Highlight, House, Kanban,
  Landmark, Moon, Receipt, Sun, Timer, Users,
} from '@/components/ds/icons';
import {
  BoardScreen, BriefScreen, CalendarScreen, CapacityScreen, ExportScreen, FinanceScreen, HighlightScreen,
  HomeScreen, InvoiceScreen, ShutdownScreen, UnbilledScreen, WaitingScreen,
} from './snippets';
import { Spotlight } from './spotlight';
import { CHAPTER } from './visual';

/** A lobe from the outer bottom corner of a stage: right-hand stages, and (flipped) left-hand ones. */
const LOBE_RIGHT = { x: 1.1, y: 1.1, size: 1.5, turn: 0.5 };
const LOBE_LEFT = { x: -0.1, y: 1.1, size: 1.5, turn: -0.25 };

export function DayArea() {
  return (
    <Spotlight
      id="day"
      field="day"
      hue={CHAPTER.day}
      icon={Sun}
      name="Your day"
      mark={LOBE_RIGHT}
      title={['Know what matters', 'before your first coffee.']}
      features={[
        { icon: House, title: 'Today, assembled for you', body: 'Home gathers what’s due, what you planned, your meetings and what’s waiting on others.', visual: () => <HomeScreen /> },
        { icon: Highlight, title: 'One highlight a day', body: 'Pick the one task that matters. It leads the day until it’s done.', visual: () => <HighlightScreen /> },
        { icon: Clock, title: 'A plan that fits your hours', body: 'Planning fits tasks around your meetings and moves what won’t fit to tomorrow.', visual: () => <CapacityScreen /> },
        { icon: Moon, title: 'Close the day', body: 'Tick off what got done, carry the rest to tomorrow, and leave yourself a note.', visual: () => <ShutdownScreen /> },
      ]}
    />
  );
}

export function ProjectsArea() {
  return (
    <Spotlight
      id="projects"
      field="projects"
      hue={CHAPTER.projects}
      icon={Folder}
      name="Projects"
      mark={LOBE_LEFT}
      title={['Every project carries its client', 'and its next move.']}
      flip
      features={[
        { icon: Kanban, title: 'Boards and lists', body: 'The same tasks as a list or a board, grouped by the workstreams in the project.', visual: () => <BoardScreen /> },
        { icon: CalendarIcon, title: 'Plan the week on your calendar', body: 'Put tasks beside your meetings. Google Calendar syncs both ways.', visual: () => <CalendarScreen /> },
        { icon: FileText, title: 'Briefs that link up', body: 'Documents link to the tasks and projects they are about.', visual: () => <BriefScreen /> },
        { icon: Users, title: 'Waiting on', body: 'Everything that is someone else’s move, kept off your plan until they make it.', visual: () => <WaitingScreen /> },
      ]}
    />
  );
}

export function MoneyArea() {
  return (
    <Spotlight
      id="money"
      field="money"
      hue={CHAPTER.money}
      icon={Landmark}
      name="Finance"
      mark={LOBE_LEFT}
      title={['Know what’s owed,', 'to the cent.']}
      flip
      features={[
        { icon: Timer, title: 'Invoices from tracked time', body: 'Time you log on a task becomes an invoice line in one step.', visual: () => <UnbilledScreen /> },
        { icon: Receipt, title: 'Payments as they arrive', body: 'Record a payment and the balance, the status and your client’s portal follow.', visual: () => <InvoiceScreen /> },
        { icon: Landmark, title: 'What’s owed, at a glance', body: 'Outstanding, paid this month and overdue, across every client.', visual: () => <FinanceScreen /> },
        { icon: Download, title: 'Ready for your accountant', body: 'Export invoices, their line items and payments as spreadsheets.', visual: () => <ExportScreen /> },
      ]}
    />
  );
}
