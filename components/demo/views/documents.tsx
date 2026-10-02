'use client';
// Docs: the product's own Documents — the studio's briefs and notes, a template, and a database (a
// projects tracker with a table, a board and a timeline) that keeps everything in the browser.
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentsView, type Folder, type Page } from '@/components/documents/documents-view';
import { dayFromToday, PERSON } from '../fixtures';

const FOLDERS: Folder[] = [
  { id: 'fd-clients', name: 'Clients', parent_folder_id: null, sort_order: 0 },
  { id: 'fd-studio', name: 'Studio', parent_folder_id: null, sort_order: 1 },
];
const SPACES = [{ id: 's-studio', name: PERSON.studio, emoji: '✦' }];

function pages(): Page[] {
  const DAY = Math.floor(Date.now() / 86_400_000) * 86_400_000;
  const updated = (hours: number) => new Date(DAY - hours * 3_600_000).toISOString();
  const tracker = {
    collection: {
      id: 'col-tracker', page_id: 'pg-tracker', name: 'Projects tracker',
      props: [
        { id: 'title', name: 'Name', type: 'title' as const },
        { id: 'status', name: 'Status', type: 'status' as const, options: [
          { id: 'not_started', name: 'Not started', color: 'gray' as const },
          { id: 'in_progress', name: 'In progress', color: 'blue' as const },
          { id: 'in_review', name: 'In review', color: 'yellow' as const },
          { id: 'done', name: 'Done', color: 'green' as const },
        ] },
        { id: 'client', name: 'Client', type: 'select' as const, options: [
          { id: 'ridgeline', name: 'Ridgeline', color: 'purple' as const },
          { id: 'beacon', name: 'Beacon Health', color: 'blue' as const },
          { id: 'copper', name: 'Copper Row', color: 'orange' as const },
        ] },
        { id: 'start', name: 'Start', type: 'date' as const },
        { id: 'due', name: 'Due', type: 'date' as const },
        { id: 'hours', name: 'Hours', type: 'number' as const },
      ],
      views: [
        { id: 'v-board', name: 'Board', kind: 'board' as const, groupBy: 'status' },
        { id: 'v-table', name: 'Table', kind: 'table' as const },
        { id: 'v-timeline', name: 'Timeline', kind: 'timeline' as const, dateProp: 'start', endDateProp: 'due', zoom: 'month' as const },
      ],
    },
    rows: [
      { id: 'row-1', title: 'Logo presentation', data: { status: 'in_progress', client: 'ridgeline', start: dayFromToday(-6), due: dayFromToday(0), hours: '12' }, order: 'c', created_at: updated(700), updated_at: updated(2) },
      { id: 'row-2', title: 'Dark-mode variants', data: { status: 'not_started', client: 'ridgeline', start: dayFromToday(1), due: dayFromToday(4), hours: '6' }, order: 'e', created_at: updated(600), updated_at: updated(20) },
      { id: 'row-3', title: 'Sitemap v3', data: { status: 'in_review', client: 'beacon', start: dayFromToday(-3), due: dayFromToday(2), hours: '8' }, order: 'g', created_at: updated(500), updated_at: updated(5) },
      { id: 'row-4', title: 'Menu photography', data: { status: 'not_started', client: 'copper', start: dayFromToday(9), due: dayFromToday(10) }, order: 'i', created_at: updated(400), updated_at: updated(30) },
      { id: 'row-5', title: 'Brand audit', data: { status: 'done', client: 'ridgeline', start: dayFromToday(-20), due: dayFromToday(-12), hours: '10' }, order: 'k', created_at: updated(900), updated_at: updated(200) },
    ],
  };
  return [
    { id: 'd-brief', folder_id: null, title: 'Ridgeline, brand brief', type: 'note', tags: ['Ridgeline'], updated_at: updated(3), icon: '🎯',
      content: { blocks: [
        { id: 'b-1', type: 'h2', text: 'The problem' },
        { id: 'b-2', type: 'text', text: 'Ridgeline’s mark was drawn for print in 2011. It breaks at app-icon size and has no dark version, and their app goes dark-first next quarter.' },
        { id: 'b-3', type: 'h2', text: 'What success looks like' },
        { id: 'b-4', type: 'bullet', text: 'One mark that holds from a 16px favicon to a billboard' },
        { id: 'b-5', type: 'bullet', text: 'A dark palette as considered as the light one' },
        { id: 'b-6', type: 'bullet', text: 'Guidelines their own team can follow without us' },
        { id: 'b-7', type: 'h2', text: 'Next steps' },
        { id: 'b-8', type: 'todo', text: 'Send the logo presentation', checked: false },
        { id: 'b-9', type: 'todo', text: 'Dark-mode variants', checked: false },
        { id: 'b-10', type: 'todo', text: 'Stakeholder interviews', checked: true },
      ] } },
    { id: 'pg-tracker', folder_id: null, title: 'Projects tracker', type: 'database', content: { demoDb: tracker }, tags: [], updated_at: updated(1), icon: '🗂' },
    { id: 'd-sitemap', folder_id: null, title: 'Beacon Health, sitemap notes', type: 'note', tags: ['Beacon Health'], updated_at: updated(26), icon: '🧭',
      content: { blocks: [
        { id: 's-1', type: 'text', text: 'Services folded into one page. Careers page requested, not yet scoped.' },
        { id: 's-2', type: 'h3', text: 'Open questions' },
        { id: 's-3', type: 'bullet', text: 'Does the patient portal link live in the header or the footer?' },
      ] } },
    { id: 'd-kickoff', folder_id: 'fd-clients', title: 'Kickoff notes, Copper Row', type: 'note', tags: ['Copper Row'], updated_at: updated(100),
      content: { blocks: [{ id: 'k-1', type: 'text', text: 'New menu launches next month. Photography in two weeks, at the restaurant.' }] } },
    { id: 'd-handbook', folder_id: 'fd-studio', title: 'Studio handbook', type: 'note', tags: [], updated_at: updated(300), icon: '📘',
      content: { blocks: [
        { id: 'h-1', type: 'h2', text: 'How we work' },
        { id: 'h-2', type: 'text', text: 'Invoices go out on the 1st. Every client gets a portal on day one. Fridays end with a weekly review.' },
      ] } },
    { id: 'd-template', folder_id: null, title: 'Project brief template', type: 'template', tags: ['brief'], updated_at: updated(500), icon: '📄',
      content: { blocks: [
        { id: 't-1', type: 'h2', text: 'The problem' },
        { id: 't-2', type: 'text', text: '' },
        { id: 't-3', type: 'h2', text: 'What success looks like' },
      ] } },
  ];
}

export default function DocumentsDemo() {
  const list = React.useMemo(() => pages(), []);
  // `/documents?page=<id>` opens that page, as the app's route reads it into `initialPageId`.
  const open = useSearchParams()?.get('page') ?? null;
  return <DocumentsView initialFolders={FOLDERS} initialPages={list} initialPageId={open} userInitial="A" userName={PERSON.name} spaces={SPACES} activeSpaceId="s-studio" />;
}
