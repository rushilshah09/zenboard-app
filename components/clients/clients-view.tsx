'use client';
// Clients hub — a calm CRM as a two-pane master/detail (client rail +
// ClientDetail) plus a lightweight lead pipeline board. The detail is the
// "memory surface" (MASTER_PRODUCT_PLAN §7K: "the client page IS the Connected
// panel writ large") — the editorial layout language established for Projects:
// a written next-step leads, quiet facts in a property strip, the client's
// linked projects / invoices / notes as hairline-divided sections, and meta in
// a right details rail. Built on DS primitives; optimistic, reconciles
// server/realtime props via `useServerState`.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Mail, Check, ArrowRight, ChevronRight, ChevronLeft, ChevronDown,
  Kanban, Users, MessageSquare, Circle, Activity, User, Calendar, Landmark,
} from "@/components/ds/icons";
import {
  Icon, Avatar, Badge, Button, SegmentedControl, EmptyState, EmptyLine,
  Modal, Field, TextInput, toast, toastReverted,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  type BadgeStatus,
  RecordHeader, Tabs, type TabItem, cardClass } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { scopeFill } from '@/lib/entity-color';
import { formatAgo, formatDay, formatMonthYear } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useRecordParam, useModeParam } from '@/lib/hub-url';
import { HubLayout } from '@/components/ui/hub-layout';
import { SectionHeading } from '@/components/ui/section-heading';
import { ConnectedPanel } from '@/components/connected/connected-panel';
import type { EntityType } from '@/lib/connected';

// Module-level so the prop keeps a stable identity across the view's renders.
const CLIENT_OMIT: EntityType[] = ['project', 'invoice', 'form', 'meeting'];
import { addClient, updateClient, addClientNote, addLead, updateLead, convertLead } from '@/lib/actions/clients';
import { addFeedback, updateFeedback, shipFeedback } from '@/lib/actions/feedback';
import { addMeeting, updateMeeting, deleteMeeting, makeTaskFromMeeting } from '@/lib/actions/meetings';
import { FeedbackBoard, AddFeedbackModal, type FeedbackItem, type FeedbackStatus, FEEDBACK_TONE as fbTone, FEEDBACK_LABEL as fbLabel } from '@/components/feedback/feedback-board';
import { MeetingPanel, type MeetingItem } from '@/components/meetings/meeting-panel';
import { meetingActions, type MeetingTaskRow } from '@/lib/meeting-actions';
import { FormsPanel } from '@/components/forms/forms-panel';
import type { FormSummary } from '@/lib/forms';
import { addTask } from '@/lib/actions/tasks';
import { addProject } from '@/lib/actions/projects';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';
import { PropertyBlock, type RecordProperty } from '@/components/records/property-block';
import { EMPTY_LAYOUT, type PropLayout } from '@/lib/property-layout';
import { setPropertyLayout } from '@/lib/actions/property-layout';

// ── Types ──────────────────────────────────────────────────────────────
export type ClientNote = { id: string; client_id: string; body: string; created_at: string };
export type ClientProject = { id: string; name: string; color: string | null; client_id: string; status: string; open: number; total: number };
export type ClientInvoice = { id: string; number: string; client_id: string; status: string; amount: number };
export type ClientCard = {
  id: string; name: string; role: string | null; contact: string | null; email: string | null;
  status: string; health: string; since: string | null; next_step: string | null; created_at?: string | null;
  notes: ClientNote[]; projects: ClientProject[]; invoices: ClientInvoice[]; forms: FormSummary[];
};
export type Lead = { id: string; name: string; contact: string | null; value: number; stage: Stage; source: string | null; note: string | null; created_at?: string | null };
type Stage = 'lead' | 'contacted' | 'proposal' | 'won';

// ── Constants ──────────────────────────────────────────────────────────
const PIPELINE_STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'lead', label: 'Lead', hint: 'Unqualified' },
  { id: 'contacted', label: 'Contacted', hint: 'In conversation' },
  { id: 'proposal', label: 'Proposal', hint: 'Awaiting decision' },
  { id: 'won', label: 'Won', hint: 'Ready to kick off' },
];
const HEALTH_KEYS = ['good', 'attention', 'risk'] as const;
const healthLabel: Record<string, string> = { good: 'Healthy', attention: 'Needs attention', risk: 'At risk' };
const healthDot: Record<string, string> = { good: 'bg-success-500', attention: 'bg-warning-500', risk: 'bg-danger-500' };
const healthTone: Record<string, BadgeStatus> = { good: 'success', attention: 'warning', risk: 'danger' };
const invStatusTone: Record<string, BadgeStatus> = { draft: 'neutral', sent: 'info', paid: 'success', overdue: 'danger', void: 'neutral' };

const fmtMoney = (n: number) => formatMoney(n);

// These three were private re-implementations of the shared vocabulary — the
// same ladder and the same formats, maintained separately. lib/date.ts is the
// one place they live now.
const relTouch = (iso?: string | null) => formatAgo(iso) ?? 'no touches';
function ageOf(iso?: string | null) {
  if (!iso) return 'new';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : days + 'd';
}
const noteDate = (iso: string) => formatDay(iso) ?? '';
const sinceLabel = (c: ClientCard) => c.since || formatMonthYear(c.created_at) || 'recently';

// ── Shared editorial primitives (same idiom as projects-workspace) ──────
// The one composer shell (ds-theme.css `@utility composer-shell`) — it also
// carries the :focus-within ring these three copies each lacked.
const composerShell = 'composer-shell';
const composerInput = 'min-w-0 flex-1 border-0 bg-transparent py-2 text-ui text-ink-900 outline-none placeholder:text-ink-500';

// Notion-style property row: a fixed-width gray label with a leading icon, then
// the value in ink. Shared shape with the Projects detail (see zenboard-ds-gotchas).
// ── Client record sections ──────────────────────────────────────────────
// The same six-section shape a project has, named with the same glossary words
// ("Money", not "Invoices"). Overview carries what is happening now — the next
// step, what we know, what is linked, and the touch log — exactly as a project's
// Overview carries its update, milestones, key tasks and activity.
const CLIENT_DETAIL_TABS = ['overview', 'projects', 'money', 'forms', 'meetings', 'feedback'] as const;
export type ClientDetailTab = (typeof CLIENT_DETAIL_TABS)[number];
const CLIENT_SECTION_TABS: TabItem[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'projects', label: 'Projects' },
  { value: 'money', label: 'Money' },
  { value: 'forms', label: 'Forms' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'feedback', label: 'Feedback' },
];

// PropRow is the DS `PropertyRow` — see components/ds/ui/record-header.tsx.
// This file used to carry a private, identical copy.

// ── Rail row ────────────────────────────────────────────────────────────
function ClientRow({ client, active, onClick }: { client: ClientCard; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'focus-ring flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-fast',
        active ? 'bg-surface-active' : 'hover:bg-surface-hover',
      )}
    >
      <Avatar name={client.name} shape="square" size="md" decorative />
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-ui', active ? 'font-medium text-ink-900' : 'text-ink-800')}>{client.name}</div>
        <div className="truncate text-caption text-ink-500">{(client.contact ?? client.role ?? '—')} · {relTouch(client.notes[0]?.created_at)}</div>
      </div>
      <span title={healthLabel[client.health]} className={cn('size-1.5 shrink-0 rounded-full', healthDot[client.health] ?? 'bg-ink-300')} />
    </button>
  );
}

// A badge-styled dropdown trigger — click the value to change it (Linear-style
// editable property). Used for the client's status and health in the rail.
function BadgeMenu({ label, tone, options, onSelect }: {
  label: string; tone: BadgeStatus;
  options: { key: string; label: string; dot?: string }[]; onSelect: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="focus-ring touch-min rounded-sm" title="Change">
          <Badge status={tone} className="cursor-pointer gap-1">{label}<Icon icon={ChevronDown} size={12} /></Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.key} onSelect={() => onSelect(o.key)}
            icon={o.dot ? <span className={cn('size-2 rounded-full', o.dot)} /> : undefined}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Client detail — the "memory surface" ────────────────────────────────
function ClientDetail({ client, tasked, feedback, meetings, meetingTasks, propertyLayout, onSetHealth, onSetStatus, onSaveNextStep, onMakeTask, onAddNote, onLogFeedback, onOpenMeeting, onNewMeeting }: {
  client: ClientCard; tasked: boolean; feedback: FeedbackItem[]; meetings: MeetingItem[]; meetingTasks: MeetingTaskRow[];
  onSetHealth: (h: string) => void; onSetStatus: (s: string) => void; onSaveNextStep: (v: string) => void;
  onMakeTask: () => void; onAddNote: (body: string) => void; onLogTouch: () => void; onLogFeedback: () => void;
  onOpenMeeting: (id: string) => void; onNewMeeting: () => void;
  /** How this person arranged the client header's properties. */
  propertyLayout: PropLayout;
}) {
  const [noteDraft, setNoteDraft] = useState('');
  const router = useRouter();

  const billed = client.invoices.reduce((a, i) => a + i.amount, 0);
  const unpaid = client.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const outstanding = unpaid.reduce((a, i) => a + i.amount, 0);

  const addNote = () => { const b = noteDraft.trim(); if (b) { onAddNote(b); setNoteDraft(''); } };

  // MODE lives in the URL (pushState), the same rule Projects follows — so a
  // link to a client's Money tab is a link, and Back returns to the tab you left.
  const [tab, setTab] = useModeParam('ctab', 'overview', CLIENT_DETAIL_TABS);

  return (
    <>
    {/* Same entity-detail header a project opens with (ds/ui/record-header.tsx).
        A client's identity mark is their initials rather than a colour chip —
        that slot is the one part of this header that carries information about
        the KIND of record. Everything else is the shared shape; this file used
        to re-state it, and had already drifted to a different title gap. */}
    <RecordHeader identity={<Avatar name={client.name} shape="square" size="lg" decorative />} title={client.name}>
      {/* Arrangeable, like a project's — the SAME block, one implementation
          (components/records/property-block.tsx), and one stored preference per
          record KIND so hiding "Billed" means it for every client rather than
          for this one. `key` is what persists, never the label.

          A ROW ONLY WHEN THERE IS SOMETHING IN IT still holds for Contact and
          Email. Both used to draw an em-dash, which is an absence announced: it
          reports that you have not filled a field in, on every client you have
          not filled it in for. That is a different rule from hiding — absent
          because there is no value, versus put away because you do not read by
          it — and they compose: a hidden row is not counted while its value is
          missing, so "1 hidden" never offers back a row with nothing in it.

          A client's values are long and varied — an address-like contact, an
          email, money with an "outstanding" tail — which is exactly what the
          fixed label column is for. */}
      <PropertyBlock
        set="client"
        layout={propertyLayout}
        onSave={setPropertyLayout}
        properties={([
          {
            key: 'status', icon: Circle, label: 'Status',
            value: <BadgeMenu label={client.status === 'active' ? 'Active' : 'Past'} tone={client.status === 'active' ? 'accent' : 'neutral'} options={[{ key: 'active', label: 'Active client' }, { key: 'past', label: 'Past client' }]} onSelect={onSetStatus} />,
          },
          {
            key: 'health', icon: Activity, label: 'Health',
            value: <BadgeMenu label={healthLabel[client.health] ?? '—'} tone={healthTone[client.health] ?? 'neutral'} options={HEALTH_KEYS.map((k) => ({ key: k, label: healthLabel[k], dot: healthDot[k] }))} onSelect={onSetHealth} />,
          },
          client.contact ? {
            key: 'contact', icon: User, label: 'Contact',
            value: <>{client.contact}{client.role ? <span className="text-ink-500"> · {client.role}</span> : null}</>,
          } : null,
          client.email ? {
            key: 'email', icon: Mail, label: 'Email',
            value: <a href={`mailto:${client.email}`} className="focus-ring touch-min rounded-xs text-ink-800 underline-offset-2 hover:underline">{client.email}</a>,
          } : null,
          { key: 'since', icon: Calendar, label: 'Client since', value: sinceLabel(client) },
          {
            key: 'billed', icon: Landmark, label: 'Billed',
            value: <><span className="tabular-nums">{fmtMoney(billed)}</span>{outstanding > 0 ? <span className="text-ink-500"> · <span className="tabular-nums">{fmtMoney(outstanding)}</span> outstanding</span> : null}</>,
          },
        ] as (RecordProperty | null)[]).filter((p): p is RecordProperty => p !== null)}
      />
    </RecordHeader>

    {/* Section tabs — the SAME mechanism a project uses to hold six sections
        (ds Tabs, one underline row, mode in the URL via useModeParam). A client
        record has exactly as many sections as a project does; stacking them in
        one 1,400px column while the neighbouring entity tabbed them is what made
        the two read as different products rather than one pattern. Tab NAMES
        follow the glossary, so "Money" here is the same word it is there. */}
    <div className="mb-6">
      <Tabs items={CLIENT_SECTION_TABS} value={tab} onValueChange={(v) => setTab(v as ClientDetailTab)} aria-label="Client sections" />
    </div>

    <div className="max-w-[720px]">
      {tab === 'overview' && (
        <>
          <section>
            <SectionHeading>Next step</SectionHeading>
            <div className={composerShell}>
              <Icon icon={ArrowRight} size={16} className="shrink-0 text-ink-500" />
              {/* Uncontrolled + keyed on the committed value: no per-keystroke
                  state, resets cleanly when the selected client changes. */}
              <input
                key={client.id + (client.next_step ?? '')}
                defaultValue={client.next_step ?? ''}
                onBlur={(e) => onSaveNextStep(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="What moves this relationship forward?"
                autoComplete="off" data-1p-ignore data-lpignore="true"
                className={composerInput}
              />
              {client.next_step && (
                <Button size="sm" variant="secondary" icon={tasked ? <Icon icon={Check} size={14} /> : undefined} onClick={onMakeTask}>
                  {tasked ? 'Added' : 'Make it a task'}
                </Button>
              )}
            </div>
          </section>
          {/* Memory's panel sat here (§7X §5.2) — HIDDEN 2026-09-07 with the rest
              of the module. Notes below still carry the event log; what is gone
              is the standing-fact surface. */}
          {/* Connected (§3.4). The plan calls the client page "the Connected panel
              writ large" — but Projects, Invoices, Forms and Meetings already have
              their own sections above, so those four are omitted and this shows
              only what nothing else does: the client's docs, their open tasks
              across every project, and any feedback traced back to them. */}
          <ConnectedPanel self={{ type: 'client', id: client.id }} omit={CLIENT_OMIT} className="mt-8" />
          {/* Notes / touch log */}
          <section className="mt-10">
            <div className="mb-2.5 flex items-center gap-2">
              <h3 className="text-h4 text-ink-900">Notes</h3>
              <span className="text-caption tabular-nums text-ink-500">{client.notes.length}</span>
            </div>
            <div className={cn(composerShell, 'mb-3')}>
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                placeholder="Log a call, a decision, a promise…"
                autoComplete="off" data-1p-ignore data-lpignore="true"
                className={composerInput}
              />
              {noteDraft.trim() && <Button size="sm" variant="secondary" onClick={addNote}>Add</Button>}
            </div>
            {client.notes.length === 0
              ? <EmptyLine>No notes yet. The best CRM is the one you actually write in.</EmptyLine>
              : client.notes.map((n) => (
                  <div key={n.id} className="border-b border-line-soft py-2.5 last:border-0">
                    <div className="mb-0.5 text-caption text-ink-500">{noteDate(n.created_at)}</div>
                    <div className="whitespace-pre-wrap text-pretty text-ui leading-relaxed text-ink-800">{n.body}</div>
                  </div>
                ))}
          </section>
        </>
      )}

      {tab === 'projects' && (
        <>
          <section>
            <div className="mb-1.5 flex items-center gap-2">
              <h3 className="text-h4 text-ink-900">Projects</h3>
              <span className="text-caption tabular-nums text-ink-500">{client.projects.length}</span>
            </div>
            {client.projects.length === 0
              ? <EmptyLine>No linked projects.</EmptyLine>
              : client.projects.map((p) => <ProjectRow key={p.id} project={p} />)}
          </section>
        </>
      )}

      {tab === 'money' && (
        <>
          <section>
            <div className="mb-1.5 flex items-center gap-2">
              <h3 className="text-h4 text-ink-900">Invoices</h3>
              <span className="text-caption tabular-nums text-ink-500">{client.invoices.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => router.push('/money')}>New</Button>
            </div>
            {client.invoices.length === 0
              ? <EmptyLine>Nothing billed yet.</EmptyLine>
              : client.invoices.map((inv) => (
                  <Link key={inv.id} href={`/money/${inv.id}`}
                    className="focus-ring flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                    <span className="font-mono text-caption text-ink-500">{inv.number}</span>
                    <span className="flex-1" />
                    <span className="tabular-nums text-ui text-ink-800">{fmtMoney(inv.amount)}</span>
                    <Badge status={invStatusTone[inv.status] ?? 'neutral'} className="capitalize">{inv.status}</Badge>
                  </Link>
                ))}
          </section>
        </>
      )}

      {tab === 'forms' && (
        <>
          {/* Forms — what we ask this client for (intake, feedback, testimonials). */}
          <FormsPanel forms={client.forms} clientId={client.id} />
        </>
      )}

      {tab === 'meetings' && (
        <>
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <h3 className="text-h4 text-ink-900">Meetings</h3>
              <span className="text-caption tabular-nums text-ink-500">{meetings.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={onNewMeeting}>New</Button>
            </div>
            {meetings.length === 0
              ? <EmptyLine>No meetings logged. Capture a call, then pull the asks out as feedback.</EmptyLine>
              : meetings.map((m) => {
                  const fbCount = feedback.filter((f) => f.meeting_id === m.id).length;
                  // What this call still owes — the one number worth reading from
                  // the outside. Counted the same way the panel counts it, so the
                  // list and the panel can never disagree.
                  const owed = meetingActions(m.notes, meetingTasks.filter((t) => t.meetingId === m.id))
                    .filter((r) => !r.done).length;
                  return (
                    <button key={m.id} type="button" onClick={() => onOpenMeeting(m.id)}
                      className="focus-ring flex w-full items-center gap-3 rounded-sm border-b border-line-soft py-2 text-left transition-colors last:border-0 hover:bg-surface-hover">
                      <Icon icon={MessageSquare} size={16} className="shrink-0 text-ink-500" />
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{m.title}</span>
                      {owed > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{owed} to do</span>}
                      {fbCount > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{fbCount} feedback</span>}
                      <span className="shrink-0 text-caption text-ink-500">{noteDate(m.met_at)}</span>
                    </button>
                  );
                })}
          </section>
        </>
      )}

      {tab === 'feedback' && (
        <>
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <h3 className="text-h4 text-ink-900">Feedback</h3>
              <span className="text-caption tabular-nums text-ink-500">{feedback.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="ghost" icon={<Icon icon={MessageSquare} size={14} />} onClick={onLogFeedback}>Log</Button>
            </div>
            {feedback.length === 0
              ? <EmptyLine>Nothing logged yet. Capture what they ask for — the highest-value asks rise to the top of Feedback.</EmptyLine>
              : feedback.map((f) => {
                  const stake = f.deals.reduce((a, d) => a + d.value, 0);
                  return (
                    <div key={f.id} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                      <span className="shrink-0 tabular-nums text-caption text-ink-500">#{f.number}</span>
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{f.title}</span>
                      {stake > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{fmtMoney(stake)}</span>}
                      <Badge status={fbTone[f.status]}>{fbLabel[f.status]}</Badge>
                    </div>
                  );
                })}
          </section>
        </>
      )}

    </div>
    </>
  );
}

function ProjectRow({ project }: { project: ClientProject }) {
  return (
    <Link href={`/projects/${project.id}`}
      className="focus-ring group flex items-center gap-2.5 border-b border-line-soft py-2 last:border-0">
      <span aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ background: scopeFill(project.color) }} />
      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{project.name}</span>
      <span className="tabular-nums text-caption text-ink-500">{project.open} open · {project.total}</span>
      <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-500 transition-colors group-hover:text-ink-600" />
    </Link>
  );
}

// ── Pipeline board ──────────────────────────────────────────────────────
function LeadCard({ lead, onAdvance, onBack, onWin, onCreateProject, onLogFeedback }: {
  lead: Lead; onAdvance: () => void; onBack: () => void; onWin: () => void; onCreateProject: () => void; onLogFeedback: () => void;
}) {
  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.id === lead.stage);
  return (
    <div className={cardClass('group p-3')}>
      <div className="mb-0.5 flex items-baseline gap-2">
        <div className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{lead.name}</div>
        {lead.value > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-700">{fmtMoney(lead.value)}</span>}
      </div>
      <div className="mb-1.5 text-caption text-ink-500">{[lead.contact, lead.source].filter(Boolean).join(' · ') || '—'}</div>
      {lead.note && <div className="mb-2 text-caption leading-relaxed text-ink-500">{lead.note}</div>}
      <div className="flex items-center gap-1.5">
        <span className="text-meta text-ink-500">{ageOf(lead.created_at)} in stage</span>
        <span className="flex-1" />
        <Button size="xs" variant="ghost" iconOnly icon={<Icon icon={MessageSquare} size={14} />} onClick={onLogFeedback} aria-label="Log feedback from this deal" className="reveal-on-hover focus-visible:opacity-100" />
        {stageIdx > 0 && lead.stage !== 'won' && <Button size="xs" variant="ghost" iconOnly icon={<Icon icon={ChevronLeft} size={14} />} onClick={onBack} aria-label="Move back" />}
        {lead.stage === 'proposal'
          // Secondary, not primary: this sits on a repeating card, so a filled
          // accent here means one per proposal-stage deal. The rule is at most
          // one filled-accent element in view.
          ? <Button size="xs" variant="secondary" icon={<Icon icon={Check} size={14} />} onClick={onWin}>Won</Button>
          : lead.stage !== 'won' && <Button size="xs" variant="secondary" iconRight={<Icon icon={ChevronRight} size={14} />} onClick={onAdvance}>{PIPELINE_STAGES[stageIdx + 1].label}</Button>}
        {lead.stage === 'won' && <Button size="xs" variant="secondary" icon={<Icon icon={Kanban} size={14} />} onClick={onCreateProject}>Create project</Button>}
      </div>
    </div>
  );
}

function PipelineBoard({ leads, onMove, onCreateProject, onLogFeedback }: {
  leads: Lead[]; onMove: (id: string, stage: Stage) => void; onNewLead: () => void; onCreateProject: (lead: Lead) => void; onLogFeedback: (lead: Lead) => void;
}) {
  const advance = (l: Lead) => { const i = PIPELINE_STAGES.findIndex((s) => s.id === l.stage); if (i < PIPELINE_STAGES.length - 1) onMove(l.id, PIPELINE_STAGES[i + 1].id); };
  const back = (l: Lead) => { const i = PIPELINE_STAGES.findIndex((s) => s.id === l.stage); if (i > 0) onMove(l.id, PIPELINE_STAGES[i - 1].id); };
  const totalOpen = leads.filter((l) => l.stage !== 'won').reduce((a, l) => a + l.value, 0);

  return (
    <>
    {/* The "New lead" button that sat here is in the page header, with every
        other tab's create action. Two buttons for one modal, 60px apart, was
        the same duplication the Feedback pane had. */}
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <span className="text-ui text-ink-500"><b className="tabular-nums text-ink-900">{fmtMoney(totalOpen)}</b> in open pipeline</span>
    </div>
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PIPELINE_STAGES.map((stage) => {
        const sleads = leads.filter((l) => l.stage === stage.id);
        const total = sleads.reduce((a, l) => a + l.value, 0);
        return (
          <div key={stage.id} className={cn('min-h-40 rounded-lg border p-2', stage.id === 'won' ? 'border-success-300 bg-success-100' : 'border-line-soft bg-surface-sunken')}>
            <div className="flex items-baseline gap-2 px-1.5 pb-2 pt-1">
              <span className="text-ui font-medium text-ink-900">{stage.label}</span>
              <span className="tabular-nums text-caption text-ink-500">{sleads.length}</span>
              <span className="flex-1" />
              <span className="tabular-nums text-caption text-ink-500">{total ? fmtMoney(total) : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              {sleads.map((l) => <LeadCard key={l.id} lead={l} onAdvance={() => advance(l)} onBack={() => back(l)} onWin={() => onMove(l.id, 'won')} onCreateProject={() => onCreateProject(l)} onLogFeedback={() => onLogFeedback(l)} />)}
              {sleads.length === 0 && <div className="rounded-md border border-dashed border-line-soft px-2 py-4 text-center text-caption text-ink-500">{stage.hint}</div>}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// ── Modals (DS Modal + Field + TextInput) ───────────────────────────────
function AddClientModal({ onClose, onAdd }: { onClose: () => void; onAdd: (input: { name: string; role: string; contact: string; email: string }) => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const submit = () => { if (!name.trim()) return; onAdd({ name: name.trim(), role: role.trim(), contact: contact.trim(), email: email.trim() }); onClose(); };
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title="New client"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={submit}>Add client</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Name / company">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="e.g. Acme Co." autoFocus autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Contact">
          <TextInput value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Who you work with" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Role">
          <TextInput value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="e.g. Head of Brand" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Email">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="name@company.com" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
      </div>
    </Modal>
  );
}

function AddLeadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (input: { name: string; contact: string; value: number }) => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [value, setValue] = useState('');
  const submit = () => { if (!name.trim()) return; onAdd({ name: name.trim(), contact: contact.trim(), value: parseInt(value, 10) || 0 }); onClose(); };
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title="New lead"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={submit}>Add lead</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Company">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="e.g. Fernwood Hotels" autoFocus autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Contact">
          <TextInput value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Who you talked to" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Est. value ($)">
          <TextInput value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="8000" inputMode="numeric" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Root ──────────────────────────────────────────────────────────────
const CLIENT_TABS = ['clients', 'pipeline', 'feedback'] as const;
type ClientTab = (typeof CLIENT_TABS)[number];

export function ClientsView({
  initialClients, initialLeads, initialFeedback = [], initialMeetings = [],
  initialMeetingTasks = [], meetingTasksSupported = false, propertyLayout = EMPTY_LAYOUT,
}: {
  initialClients: ClientCard[]; initialLeads: Lead[]; initialFeedback?: FeedbackItem[]; initialMeetings?: MeetingItem[];
  /** The tasks meetings have already produced — PRODUCT_THINKING §8. */
  initialMeetingTasks?: MeetingTaskRow[];
  /** 0027 (`mentions`) present: without it a meeting cannot remember its tasks. */
  meetingTasksSupported?: boolean;
  /** How this person arranged the header's properties (lib/property-layout.ts).
   *  A per-user preference out of `profiles.preferences`, not client data. */
  propertyLayout?: PropLayout;
}) {
  const router = useRouter();
  const [clients, setClients] = useServerState(initialClients);
  const [leads, setLeads] = useServerState(initialLeads);
  const [feedback, setFeedback] = useServerState(initialFeedback);
  const [meetings, setMeetings] = useServerState(initialMeetings);
  const [meetingTasks, setMeetingTasks] = useServerState(initialMeetingTasks);
  // A meeting is ADDRESSABLE (§7J). It used to be local state, which meant
  // `recordHref('meeting')` had nothing to return — so every meeting row in a
  // Connected panel rendered as text you could not click, including the ones the
  // meeting→task edges create. `?meeting=<id>` is a real link from anywhere, and
  // it carries its own client: the id is enough to find both.
  const [openMeetingId, setOpenMeetingId] = useRecordParam('meeting');

  // The tab is a MODE, so it lives in the URL and pushes history (lib/hub-url.ts):
  // `/clients?tab=pipeline` is a link you can send, and Back returns you to the
  // tab you came from instead of leaving Clients altogether.
  const [tab, setTab] = useModeParam('tab', 'clients', CLIENT_TABS);
  // Which client is open lives in the URL (§7J), so `/clients?c=<id>` is a real
  // link — that is what lets the Connected panel point here at all.
  const [urlClientId, setActiveId] = useRecordParam('c');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [tasked, setTasked] = useState<Set<string>>(new Set());

  // Fall back to the first client rather than reconciling a stale id in an effect:
  // a URL naming a deleted client now lands somewhere sensible instead of flashing
  // an empty pane and then correcting itself.
  // A meeting named in the URL decides the client, because arriving at
  // `?meeting=<id>` from a task's Connected panel carries no client id — and
  // opening a meeting panel over the wrong client's page would be worse than
  // not opening it at all.
  const urlMeeting = openMeetingId ? meetings.find((m) => m.id === openMeetingId) : null;
  const active = clients.find((c) => c.id === (urlMeeting?.client_id ?? urlClientId)) ?? clients[0];
  const actives = clients.filter((c) => c.status === 'active');
  const pasts = clients.filter((c) => c.status !== 'active');

  // ── client mutations ──
  const patch = (id: string, p: Partial<ClientCard>) => setClients((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function setHealth(c: ClientCard, health: string) { patch(c.id, { health }); updateClient(c.id, { health: health as 'good' | 'attention' | 'risk' }); }
  function setStatus(c: ClientCard, status: string) { if (status === c.status) return; patch(c.id, { status }); updateClient(c.id, { status: status as 'active' | 'past' }); }
  function saveNextStep(c: ClientCard, value: string) {
    const v = value.trim() || null;
    if (v === (c.next_step ?? null)) return;
    patch(c.id, { next_step: v }); updateClient(c.id, { next_step: v });
    setTasked((s) => { const n = new Set(s); n.delete(c.id); return n; });
  }
  async function makeTask(c: ClientCard) {
    if (!c.next_step) return;
    setTasked((s) => new Set(s).add(c.id));
    const res = await addTask({ title: c.next_step, isInbox: true });
    if ('error' in res) { setTasked((s) => { const n = new Set(s); n.delete(c.id); return n; }); toastReverted(res.error); }
    else toast({ message: 'Added to Inbox', variant: 'info' });
  }
  async function addNote(c: ClientCard, body: string) {
    const tmp = tempId();
    const note: ClientNote = { id: tmp, client_id: c.id, body, created_at: new Date().toISOString() };
    patch(c.id, { notes: [note, ...c.notes] });
    const res = await addClientNote(c.id, body);
    setClients((cs) => cs.map((x) => {
      if (x.id !== c.id) return x;
      if ('id' in res) return { ...x, notes: x.notes.map((n) => (n.id === tmp ? { ...n, id: res.id } : n)) };
      return { ...x, notes: x.notes.filter((n) => n.id !== tmp) };
    }));
  }
  function logTouch(c: ClientCard) { addNote(c, 'Logged a touch.'); }

  /** An action item becomes a task. The server owns the destination and the
   *  duplicate guard, so what comes back is what was written — no optimistic
   *  row here would be honest, and this is one click, not a keystroke. */
  async function makeMeetingTask(meetingId: string, title: string) {
    // A server action can THROW as well as return an error — `requireSession()`
    // does exactly that on an expired session (see components/sharing/apply-share.ts
    // for the same reasoning). Without this the click would spin, stop, and say
    // nothing, and the item would still be sitting there looking un-promoted.
    let res: Awaited<ReturnType<typeof makeTaskFromMeeting>>;
    try {
      res = await makeTaskFromMeeting(meetingId, title);
    } catch {
      toast({ message: 'Could not save that — check your connection and try again.', variant: 'error' });
      return;
    }
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setMeetingTasks((rows) => (rows.some((r) => r.taskId === res.taskId) ? rows : [
      ...rows,
      { meetingId, taskId: res.taskId, title: res.title, done: false, projectId: res.projectId },
    ]));
  }

  async function createClientRow(input: { name: string; role: string; contact: string; email: string }) {
    const tmp = tempId();
    const optimistic: ClientCard = { id: tmp, name: input.name, role: input.role || null, contact: input.contact || null, email: input.email || null, status: 'active', health: 'good', since: null, next_step: null, created_at: new Date().toISOString(), notes: [], projects: [], invoices: [], forms: [] };
    setClients((cs) => [...cs, optimistic]);
    setActiveId(tmp); setTab('clients');
    const res = await addClient({ name: input.name, role: input.role, contact: input.contact, email: input.email });
    if ('id' in res) { setClients((cs) => cs.map((c) => (c.id === tmp ? { ...c, id: res.id } : c))); setActiveId(res.id); }
    else setClients((cs) => cs.filter((c) => c.id !== tmp));
  }

  // ── lead mutations ──
  function moveLead(id: string, stage: Stage) { setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l))); updateLead(id, { stage }); }
  async function createLead(input: { name: string; contact: string; value: number }) {
    const tmp = tempId();
    setLeads((ls) => [...ls, { id: tmp, name: input.name, contact: input.contact || null, value: input.value, stage: 'lead', source: 'Manual', note: null, created_at: new Date().toISOString() }]);
    const res = await addLead({ name: input.name, contact: input.contact, value: input.value });
    if ('id' in res) setLeads((ls) => ls.map((l) => (l.id === tmp ? { ...l, id: res.id } : l)));
    else setLeads((ls) => ls.filter((l) => l.id !== tmp));
  }
  async function createProjectFromLead(lead: Lead) {
    setLeads((ls) => ls.filter((l) => l.id !== lead.id));
    const conv = await convertLead(lead.id);
    if ('id' in conv) { await addProject({ name: lead.name, clientId: conv.id }); toast({ message: `Project created for ${lead.name}`, variant: 'info' }); router.refresh(); }
    else setLeads((ls) => [...ls, lead]);
  }

  // ── feedback mutations (the fabric loop) ──
  const deals = leads.map((l) => ({ id: l.id, name: l.name, value: l.value }));
  const [logFeedback, setLogFeedback] = useState(false); // the plain "log feedback" path (header action + empty state)
  const [logForDeal, setLogForDeal] = useState<string | null>(null); // deal id to pre-link when logging from the pipeline
  const [logForClient, setLogForClient] = useState<string | null>(null); // client id when logging from a client's detail
  async function createFeedback(input: { title: string; dealIds: string[]; clientId?: string | null; source?: string; meetingId?: string | null }) {
    if (!input.title.trim()) return;
    const tmp = tempId();
    const linked = deals.filter((d) => input.dealIds.includes(d.id));
    const nextNum = feedback.reduce((m, f) => Math.max(m, f.number), 0) + 1;
    setFeedback((fs) => [{ id: tmp, number: nextNum, title: input.title, body: null, status: 'open', source: input.source ?? 'manual', client_id: input.clientId ?? null, meeting_id: input.meetingId ?? null, task_id: null, created_at: new Date().toISOString(), deals: linked }, ...fs]);
    toast({ message: 'Feedback logged', variant: 'info' });
    const res = await addFeedback({ title: input.title, dealIds: input.dealIds, clientId: input.clientId ?? undefined, source: input.source, meetingId: input.meetingId ?? undefined });
    if ('error' in res) { setFeedback((fs) => fs.filter((f) => f.id !== tmp)); toastReverted(res.error); }
    else setFeedback((fs) => fs.map((f) => (f.id === tmp ? { ...f, id: res.id, number: res.number } : f)));
  }

  // ── meeting mutations (the "2.2" card — conversations feedback comes from) ──
  async function createMeeting(clientId: string) {
    const tmp = tempId();
    const now = new Date().toISOString();
    setMeetings((ms) => [{ id: tmp, client_id: clientId, title: 'Meeting', notes: null, met_at: now, created_at: now }, ...ms]);
    setOpenMeetingId(tmp);
    const res = await addMeeting({ clientId, title: 'Meeting' });
    if ('id' in res) { setMeetings((ms) => ms.map((m) => (m.id === tmp ? { ...m, id: res.id } : m))); setOpenMeetingId(res.id); }
    else { setMeetings((ms) => ms.filter((m) => m.id !== tmp)); setOpenMeetingId(null); }
  }
  function saveMeetingNotes(id: string, notes: string) {
    setMeetings((ms) => ms.map((m) => (m.id === id ? { ...m, notes } : m)));
    updateMeeting(id, { notes: notes.trim() || null });
  }
  async function removeMeeting(id: string) {
    setMeetings((ms) => ms.filter((m) => m.id !== id));
    if (openMeetingId === id) setOpenMeetingId(null);
    await deleteMeeting(id);
  }
  function setFeedbackStatus(id: string, status: FeedbackStatus) {
    setFeedback((fs) => fs.map((f) => (f.id === id ? { ...f, status } : f)));
    updateFeedback(id, { status });
  }
  async function shipFeedbackItem(id: string) {
    setFeedback((fs) => fs.map((f) => (f.id === id ? { ...f, status: 'in_progress' } : f)));
    const res = await shipFeedback(id);
    if ('error' in res) { setFeedback((fs) => fs.map((f) => (f.id === id ? { ...f, status: 'planned' } : f))); toast({ message: res.error, variant: 'error' }); }
    else { setFeedback((fs) => fs.map((f) => (f.id === id ? { ...f, task_id: res.taskId } : f))); toast({ message: 'Shipped — task added to Inbox', variant: 'success' }); }
  }

  // The one header row, above BOTH panes — so a two-pane hub's actions land on
  // the same axis as every single-pane page's. NO title: in a master/detail hub
  // the selected record is already named twice — the rail row is highlighted and
  // the detail leads with an H1. A third copy in the header is noise, and it
  // pushed the switcher off the left edge where every other module starts it.
  return (
    <HubLayout
      railLabel="Clients"
      contentKey={tab === 'clients' ? active?.id : tab}
      rail={(
        <>
            {/* No "Clients" heading: the page header's segmented already reads
                Clients · Pipeline · Feedback with the current one selected, so this
                was the module's name a second time, 40px below itself. Rails
                navigate; headers act — the "+" that used to sit here opened the same
                modals the page header now offers by name. */}
            {tab === 'clients' ? (
              <>
                <div className="px-2.5 pb-1 pt-1.5 text-caption font-medium text-ink-500">Active · {actives.length}</div>
                {actives.map((c) => <ClientRow key={c.id} client={c} active={c.id === active?.id} onClick={() => setActiveId(c.id)} />)}
                {pasts.length > 0 && <div className="px-2.5 pb-1 pt-4 text-caption font-medium text-ink-500">Past · {pasts.length}</div>}
                {pasts.map((c) => <ClientRow key={c.id} client={c} active={c.id === active?.id} onClick={() => setActiveId(c.id)} />)}
              </>
            ) : tab === 'pipeline' ? (
              <div className="px-2.5 pb-1 pt-1.5 text-caption font-medium text-ink-500">Pipeline · {leads.length}</div>
            ) : (
              <div className="px-2.5 pb-1 pt-1.5 text-caption font-medium text-ink-500">Feedback · {feedback.filter((f) => f.status !== 'declined').length}</div>
            )}
        </>
      )}
      overlays={(
        <>
          {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onAdd={createClientRow} />}
          {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} onAdd={createLead} />}
          {logFeedback && <AddFeedbackModal deals={deals} onClose={() => setLogFeedback(false)} onAdd={createFeedback} />}
          {logForDeal && <AddFeedbackModal deals={deals} presetDealIds={[logForDeal]} onClose={() => setLogForDeal(null)} onAdd={(input) => createFeedback({ ...input, source: 'deal' })} />}
          {logForClient && <AddFeedbackModal deals={deals} onClose={() => setLogForClient(null)} onAdd={(input) => createFeedback({ ...input, clientId: logForClient, source: 'client' })} />}
          {openMeetingId && (() => {
            const m = meetings.find((x) => x.id === openMeetingId);
            return m ? (
              <MeetingPanel
                // Remount per meeting: the transcript and its action list are local
                // state, and without this, opening a second meeting would show the
                // first one's words.
                key={m.id}
                meeting={m}
                feedback={feedback.filter((f) => f.meeting_id === m.id)}
                tasks={meetingTasks.filter((t) => t.meetingId === m.id)}
                projects={clients.find((c) => c.id === m.client_id)?.projects ?? []}
                linkSupported={meetingTasksSupported}
                onMakeTask={(title) => makeMeetingTask(m.id, title)}
                onClose={() => setOpenMeetingId(null)}
                onSaveNotes={(n) => saveMeetingNotes(m.id, n)}
                onAddFeedback={(t) => createFeedback({ title: t, dealIds: [], clientId: m.client_id ?? undefined, source: 'meeting', meetingId: m.id })}
                onDelete={() => removeMeeting(m.id)}
              />
            ) : null;
          })()}
        </>
      )}
        // A segmented control in the header's left lane — the same switcher
        // Forms uses, so the top level of every module reads the same way.
        // (Underline Tabs stay for a single record's detail sections, as in
        // Projects.) It lives here rather than in the rail because the rail is
        // 211px and the three options need ~250px: "Feedback" scrolled out of
        // sight there, with hideScrollbar leaving no hint it existed.
        tabs={(
          <SegmentedControl
            aria-label="Clients, pipeline, or feedback"
            value={tab}
            onValueChange={(t) => setTab(t as ClientTab)}
            options={[
              { value: 'clients', label: 'Clients' },
              { value: 'pipeline', label: 'Pipeline' },
              { value: 'feedback', label: 'Feedback' },
            ]}
            fit="content"
          />
        )}
        // Every tab of this module now puts its create/act affordance in the
        // same slot. Feedback had none here and instead grew its own header row
        // inside the pane, which is how it ended up with two differently-worded
        // buttons for one modal.
        actions={tab === 'clients' && active ? (
          <>
            {active.email && (
              <Button size="sm" variant="ghost" icon={<Icon icon={Mail} size={16} />}
                onClick={() => { window.location.href = `mailto:${active.email}`; }}>Email</Button>
            )}
            <Button size="sm" variant="secondary" icon={<Icon icon={Check} size={16} />}
              onClick={() => logTouch(active)}>Log a touch</Button>
          </>
        ) : tab === 'pipeline' ? (
          <Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={16} />}
            onClick={() => setShowAddLead(true)}>New lead</Button>
        ) : feedback.some((f) => f.status !== 'declined') ? (
          // Hidden while the board is empty: there the EmptyState is the single,
          // clearer call to action. Two buttons on an empty screen is exactly
          // what this pane was reported for.
          <Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={16} />}
            onClick={() => setLogFeedback(true)}>Log feedback</Button>
        ) : undefined}
    >
    {tab === 'clients' ? (
      active ? (
        <ClientDetail
          propertyLayout={propertyLayout}
          client={active}
          tasked={tasked.has(active.id)}
          feedback={feedback.filter((f) => f.client_id === active.id && f.status !== 'declined')}
          meetings={meetings.filter((m) => m.client_id === active.id)}
          meetingTasks={meetingTasks}
          onSetHealth={(h) => setHealth(active, h)}
          onSetStatus={(s) => setStatus(active, s)}
          onSaveNextStep={(v) => saveNextStep(active, v)}
          onMakeTask={() => makeTask(active)}
          onAddNote={(b) => addNote(active, b)}
          onLogTouch={() => logTouch(active)}
          onLogFeedback={() => setLogForClient(active.id)}
          onOpenMeeting={(id) => setOpenMeetingId(id)}
          onNewMeeting={() => createMeeting(active.id)}
        />
      ) : (
        <div className="grid h-full place-items-center">
          <EmptyState
            illustration={<Icon icon={Users} size={20} />}
            title="No clients yet"
            description="Add one to track health, next steps, and projects."
            primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setShowAddClient(true)}>New client</Button>}
          />
        </div>
      )
    ) : tab === 'pipeline' ? (
      <PipelineBoard leads={leads} onMove={moveLead} onNewLead={() => setShowAddLead(true)} onCreateProject={createProjectFromLead} onLogFeedback={(lead) => setLogForDeal(lead.id)} />
    ) : (
      <FeedbackBoard items={feedback} onRequestNew={() => setLogFeedback(true)} onSetStatus={setFeedbackStatus} onShip={shipFeedbackItem} />
    )}
    </HubLayout>
  );
}
