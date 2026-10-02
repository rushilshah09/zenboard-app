'use client';
// Dev-only harness for the Form Builder F1 surfaces. Auth-free: everything runs
// in `demo` mode so no server action is ever called. 404s in production.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { SegmentedControl } from '@/components/ds/ui';
import { FormsPanel } from '@/components/forms/forms-panel';
import { FormBuilder } from '@/components/forms/form-builder';
import { FormRenderer } from '@/components/forms/form-renderer';
import { ResponsesView } from '@/components/forms/responses-view';
import { InsightsView } from '@/components/forms/insights-view';
import { ShareView } from '@/components/forms/share-view';
import type { FormRecord, FormSummary, ResponseRecord } from '@/lib/forms';
import type { FormBlock } from '@/lib/form-schema';

const iso = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const BLOCKS: FormBlock[] = [
  { id: 'f0', type: 'hidden', label: '', param: 'source' },
  { id: 'f1', type: 'short_text', label: 'Your name', required: true, param: 'name' },
  { id: 'f2', type: 'email', label: 'Email', required: true, param: 'email' },
  { id: 'f3', type: 'heading', label: 'About the project' },
  { id: 'f4', type: 'long_text', label: 'What are we making?', help: 'A sentence or two is plenty.', required: true, min: 20 },
  { id: 'f5', type: 'select', label: 'What kind of work is it?', options: ['Brand identity', 'Website', 'Product design'], required: true, other: true },
  { id: 'f6', type: 'multi_select', label: 'What do you need from us?', options: ['Strategy', 'Design', 'Copywriting', 'Build'], max: 3 },
  // ── logic: these two only appear on the branches that need them
  { id: 'f13', type: 'long_text', label: 'How many pages, roughly?', showWhen: { fieldId: 'f5', op: 'is', value: 'Website' } },
  { id: 'f16', type: 'url', label: 'Your current website' },
  { id: 'pb1', type: 'page_break', label: '' },
  { id: 'f7', type: 'dropdown', label: 'Budget range', options: ['Under $5k', '$5–15k', '$15–40k', '$40k+'] },
  { id: 'f8', type: 'date', label: 'When do you need it live?' },
  { id: 'f17', type: 'time', label: 'A good time for a call?' },
  { id: 'f9', type: 'rating', label: 'How urgent is this?' },
  { id: 'f18', type: 'ranking', label: 'Put these in order of importance', options: ['Speed', 'Quality', 'Budget'], shuffle: true },
  { id: 'f10', type: 'yes_no', label: 'Have we worked together before?' },
  { id: 'f12', type: 'short_text', label: 'Which project was that?', showWhen: { fieldId: 'f10', op: 'is', value: 'Yes' } },
  { id: 'f19', type: 'scale', label: 'How likely are you to recommend us?', min: 0, max: 10, minLabel: 'Not likely', maxLabel: 'Very likely' },
  { id: 'f14', type: 'file', label: 'Anything to share?', help: 'A brief, moodboard or PDF.' },
  { id: 'f11', type: 'phone', label: 'Phone' },
  { id: 'f20', type: 'checkbox', label: 'I agree to be contacted about this project', required: true },
];

const FORM: FormRecord = {
  id: 'demo-form',
  title: 'Project kickoff brief',
  description: 'A few questions so we can start with a clear picture. Takes about three minutes.',
  status: 'live',
  blocks: BLOCKS,
  settings: { mode: 'page', collectIdentity: false, thanksTitle: 'Thank you, that’s everything.', thanks: 'We’ll come back to you within two working days.', submitLabel: 'Send the brief', limit: null, closeAt: null },
  version: 2,
  shareToken: 'demoTokenForPreview123',
  clientId: 'c1',
  projectId: null,
  studio: 'Meridian Studio',
  views: 148,
  showInPortal: true,
};

const SUMMARIES: FormSummary[] = [
  { id: 'demo-form', title: 'Project kickoff brief', status: 'live', shareToken: 'demoTokenForPreview123', updatedAt: iso(1), responses: 12, partials: 3 },
  { id: 'f-b', title: 'Design feedback — round 2', status: 'live', shareToken: 'tok2', updatedAt: iso(4), responses: 5, partials: 0 },
  { id: 'f-c', title: 'Testimonial request', status: 'draft', shareToken: null, updatedAt: iso(9), responses: 0, partials: 0 },
  { id: 'f-d', title: 'Post-project review', status: 'closed', shareToken: 'tok4', updatedAt: iso(31), responses: 8, partials: 1 },
];

const RESPONSES: ResponseRecord[] = [
  {
    id: 'r1', status: 'complete', formVersion: 2, createdAt: iso(1),
    answers: { f0: 'newsletter', f16: 'northstar.co', f17: '10:30', f18: ['Quality', 'Speed', 'Budget'], f19: 9, f20: true, f1: 'Dana Okafor', f2: 'dana@northstar.co', f4: 'A full rebrand for our B2B analytics product — new mark, type system, and a site refresh.', f5: 'Brand identity', f6: ['Strategy', 'Design'], f7: '$15–40k', f8: '2026-10-01', f9: 4, f10: 'No', f11: '+1 415 555 0134', f14: 'demo-form/9f8e7d6c5b4a-brand-brief.pdf' },
    respondent: { name: 'Dana Okafor', email: 'dana@northstar.co' },
    meta: { source: 'link', duration_s: 214, started_at: iso(1), completed_at: iso(1) }, taskId: 'task-1',
  },
  {
    id: 'r2', status: 'complete', formVersion: 2, createdAt: iso(3),
    answers: { f0: 'referral', f17: '16:00', f18: ['Budget', 'Speed', 'Quality'], f19: 7, f20: true, f1: 'Marco Lind', f2: 'marco@fieldnotes.io', f4: 'Marketing site redesign, five pages, plus a simple CMS so we can publish ourselves.', f5: 'Website', f6: ['Design', 'Build'], f7: '$5–15k', f9: 3, f10: 'Yes' },
    respondent: { name: 'Marco Lind', email: 'marco@fieldnotes.io' },
    meta: { source: 'portal', duration_s: 168, started_at: iso(3), completed_at: iso(3) }, taskId: null,
  },
  {
    id: 'r3', status: 'complete', formVersion: 1, createdAt: iso(8),
    answers: { f0: 'newsletter', f18: ['Quality', 'Budget', 'Speed'], f19: 10, f20: true, f1: 'Priya Raman', f2: 'priya@lumen.design', f4: 'Design system audit and component library cleanup.', f5: 'Product design', f6: ['Design'], f7: 'Under $5k', f9: 5, f10: 'No' },
    respondent: null,
    meta: { source: 'link', duration_s: 96, started_at: iso(8), completed_at: iso(8) }, taskId: null,
  },
  {
    id: 'r4', status: 'partial', formVersion: 2, createdAt: iso(0),
    answers: { f1: 'Sam', f2: 'sam@' },
    respondent: null,
    meta: { source: 'link', started_at: iso(0), last_field_id: 'f11' }, taskId: null,
  },
  {
    id: 'r5', status: 'partial', formVersion: 2, createdAt: iso(0),
    answers: { f1: 'Jo', f2: 'jo@studio.com', f4: 'Site refresh' },
    respondent: null,
    meta: { source: 'link', started_at: iso(0), last_field_id: 'f11' }, taskId: null,
  },
  {
    id: 'r6', status: 'partial', formVersion: 2, createdAt: iso(2),
    answers: { f1: 'Alex' },
    respondent: null,
    meta: { source: 'link', started_at: iso(2), last_field_id: 'f7' }, taskId: null,
  },
];

const PUBLIC_FORM = {
  id: FORM.id, version: FORM.version, title: FORM.title,
  description: FORM.description, blocks: FORM.blocks, settings: FORM.settings, studio: FORM.studio,
};

type View = 'panel' | 'builder' | 'fill' | 'focus' | 'share' | 'insights' | 'responses';

export default function FormsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Harness />;
}

function Harness() {
  const [view, setView] = useState<View>('builder');
  return (
    <div className="min-h-[100dvh] bg-canvas">
      {/* The switcher is wider than a phone — let the toolbar scroll rather than
          the page, so a mobile check measures the surface and not the harness. */}
      <div className="flex items-center gap-3 overflow-x-auto border-b border-line-soft px-4 py-2.5">
        <span className="shrink-0 text-meta text-ink-500">Form Builder F1 — harness</span>
        <SegmentedControl
          aria-label="Preview surface"
          fit="content"
          value={view}
          onValueChange={(v) => setView(v as View)}
          options={[
            { value: 'panel', label: 'Forms panel' },
            { value: 'builder', label: 'Builder' },
            { value: 'fill', label: 'Public form' },
            { value: 'focus', label: 'Focus mode' },
            { value: 'share', label: 'Share' },
            { value: 'insights', label: 'Insights' },
            { value: 'responses', label: 'Responses' },
          ]}
        />
      </div>

      {view === 'panel' && (
        <div className="mx-auto max-w-[720px] px-6 py-8">
          <FormsPanel forms={SUMMARIES} clientId="c1" />
          <div className="mt-10">
            <FormsPanel forms={[]} projectId="p1" />
          </div>
        </div>
      )}
      {view === 'builder' && <div className="h-[calc(100dvh-49px)]"><FormBuilder form={FORM} studio={FORM.studio} demo /></div>}
      {view === 'fill' && <FormRenderer form={PUBLIC_FORM} preview seed={7} params={{ source: 'newsletter', email: 'dana@northstar.co' }} />}
      {view === 'focus' && <FormRenderer form={{ ...PUBLIC_FORM, settings: { ...PUBLIC_FORM.settings, mode: 'focus' } }} preview />}
      {view === 'share' && <ShareView form={FORM} demo />}
      {view === 'insights' && <InsightsView form={FORM} responses={RESPONSES} />}
      {view === 'responses' && <ResponsesView form={FORM} responses={RESPONSES} demo />}
    </div>
  );
}
