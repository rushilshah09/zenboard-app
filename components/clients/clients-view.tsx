'use client';
// Clients hub — a calm CRM as a two-pane master/detail (client rail +
// ClientDetail) plus a lightweight lead pipeline board. The detail is the
// "memory surface" (MASTER_PRODUCT_PLAN §7K: "the client page IS the Connected
// panel writ large") — the editorial layout language established for Projects:
// a written next-step leads, quiet facts in a property strip, the client's
// linked projects / invoices / notes as hairline-divided sections, and meta in
// a right details rail. Built on DS primitives; optimistic, reconciles
// server/realtime props via useEffect.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Mail, Check, ArrowRight, ChevronRight, ChevronLeft, ChevronDown,
  Kanban, Users, MessageSquare, Circle, Activity, User, Calendar, Landmark, type IconType,
} from "@/components/ds/icons";
import {
  Icon, Avatar, Badge, Button, SegmentedControl, EmptyState,
  Modal, Field, TextInput, Toaster, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  type BadgeStatus,
} from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { addClient, updateClient, addClientNote, addLead, updateLead, convertLead } from '@/lib/actions/clients';
import { addFeedback, updateFeedback, shipFeedback } from '@/lib/actions/feedback';
import { addMeeting, updateMeeting, deleteMeeting } from '@/lib/actions/meetings';
import { FeedbackBoard, AddFeedbackModal, type FeedbackItem, type FeedbackStatus, FEEDBACK_TONE as fbTone, FEEDBACK_LABEL as fbLabel } from '@/components/feedback/feedback-board';
import { MeetingPanel, type MeetingItem } from '@/components/meetings/meeting-panel';
import { FormsPanel } from '@/components/forms/forms-panel';
import type { FormSummary } from '@/lib/forms';
import { addTask } from '@/lib/actions/tasks';
import { addProject } from '@/lib/actions/projects';
import { useViewWidth } from '@/components/shell/view-width';

// ── Types ──────────────────────────────────────────────────────────────
export type ClientNote = { id: string; client_id: string; body: string; created_at: string };
export type ClientProject = { id: string; name: string; color: string | null; client_id: string; open: number; total: number };
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

const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

function relTouch(iso?: string | null) {
  if (!iso) return 'no touches';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function ageOf(iso?: string | null) {
  if (!iso) return 'new';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : days + 'd';
}
function noteDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function sinceLabel(c: ClientCard) {
  if (c.since) return c.since;
  if (c.created_at) return new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return 'recently';
}

// ── Shared editorial primitives (same idiom as projects-workspace) ──────
const sectionLabel = 'text-caption font-medium tracking-[0.02em] text-ink-500';
const composerShell = 'flex items-center gap-2 rounded-lg border border-line-strong bg-surface-raised py-1 pl-3.5 pr-1.5';
const composerInput = 'min-w-0 flex-1 border-0 bg-transparent py-2 text-ui text-ink-900 outline-none placeholder:text-ink-400';

function PropDot() {
  return <span aria-hidden className="text-ink-300">·</span>;
}
// Notion-style property row: a fixed-width gray label with a leading icon, then
// the value in ink. Shared shape with the Projects detail (see zenboard-ds-gotchas).
function PropRow({ icon, label, children }: { icon: IconType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <span className="flex w-[124px] shrink-0 items-center gap-2 text-ui text-ink-500">
        <Icon icon={icon} size={15} className="shrink-0 text-ink-400" strokeWidth={1.75} />{label}
      </span>
      <div className="min-w-0 flex-1 text-ui text-ink-800">{children}</div>
    </div>
  );
}

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
        <button type="button" className="focus-ring rounded-sm" title="Change">
          <Badge status={tone} className="cursor-pointer gap-1">{label}<Icon icon={ChevronDown} size={11} /></Badge>
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
function ClientDetail({ client, tasked, feedback, meetings, onSetHealth, onSetStatus, onSaveNextStep, onMakeTask, onAddNote, onLogTouch, onLogFeedback, onOpenMeeting, onNewMeeting }: {
  client: ClientCard; tasked: boolean; feedback: FeedbackItem[]; meetings: MeetingItem[];
  onSetHealth: (h: string) => void; onSetStatus: (s: string) => void; onSaveNextStep: (v: string) => void;
  onMakeTask: () => void; onAddNote: (body: string) => void; onLogTouch: () => void; onLogFeedback: () => void;
  onOpenMeeting: (id: string) => void; onNewMeeting: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState('');
  const { full } = useViewWidth();
  const router = useRouter();

  const billed = client.invoices.reduce((a, i) => a + i.amount, 0);
  const unpaid = client.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const outstanding = unpaid.reduce((a, i) => a + i.amount, 0);
  const lastTouch = client.notes[0]?.created_at;

  const addNote = () => { const b = noteDraft.trim(); if (b) { onAddNote(b); setNoteDraft(''); } };

  return (
    <div key={client.id} className={cn('px-[clamp(18px,3vw,40px)] pb-16 pt-8', !full && 'mx-auto max-w-[1200px]')} style={{ animation: 'fadein 180ms' }}>
      {/* Header — a Notion page header: avatar + a large title, actions right.
          Status/health move into the properties block below. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Avatar name={client.name} shape="square" size="lg" decorative />
        <h1 className="text-balance text-h1 text-ink-900">{client.name}</h1>
        <span className="flex-1" />
        <div className="flex shrink-0 items-center gap-2">
          {client.email && <Button size="sm" variant="ghost" icon={<Icon icon={Mail} size={16} />} onClick={() => { window.location.href = `mailto:${client.email}`; }}>Email</Button>}
          <Button size="sm" variant="secondary" icon={<Icon icon={Check} size={16} />} onClick={onLogTouch}>Log a touch</Button>
        </div>
      </div>

      {/* Properties — Notion-style labelled rows under the title, replacing the
          middot strip AND the right details rail. Status/health stay interactive. */}
      <div className="mb-7 flex flex-col gap-px">
        <PropRow icon={Circle} label="Status">
          <BadgeMenu label={client.status === 'active' ? 'Active' : 'Past'} tone={client.status === 'active' ? 'accent' : 'neutral'} options={[{ key: 'active', label: 'Active client' }, { key: 'past', label: 'Past client' }]} onSelect={onSetStatus} />
        </PropRow>
        <PropRow icon={Activity} label="Health">
          <BadgeMenu label={healthLabel[client.health] ?? '—'} tone={healthTone[client.health] ?? 'neutral'} options={HEALTH_KEYS.map((k) => ({ key: k, label: healthLabel[k], dot: healthDot[k] }))} onSelect={onSetHealth} />
        </PropRow>
        <PropRow icon={User} label="Contact">{client.contact ? <>{client.contact}{client.role ? <span className="text-ink-500"> · {client.role}</span> : null}</> : <span className="text-ink-400">—</span>}</PropRow>
        <PropRow icon={Mail} label="Email">{client.email ? <a href={`mailto:${client.email}`} className="focus-ring rounded-xs text-ink-800 underline-offset-2 hover:underline">{client.email}</a> : <span className="text-ink-400">—</span>}</PropRow>
        <PropRow icon={Calendar} label="Client since">{sinceLabel(client)}</PropRow>
        <PropRow icon={Landmark} label="Billed"><span className="tabular-nums">{fmtMoney(billed)}</span>{outstanding > 0 ? <span className="text-ink-500"> · <span className="tabular-nums">{fmtMoney(outstanding)}</span> outstanding</span> : null}</PropRow>
      </div>

      <div className="max-w-[720px]">
          {/* Next step — the relationship's leading sentence (the hill chart). */}
          <section>
            <h3 className="mb-2.5 text-h4 text-ink-900">Next step</h3>
            <div className={composerShell}>
              <Icon icon={ArrowRight} size={15} className="shrink-0 text-ink-500" />
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

          {/* Projects */}
          <section className="mt-10">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-h4 text-ink-900">Projects</span>
              <span className="text-caption tabular-nums text-ink-500">{client.projects.length}</span>
            </div>
            {client.projects.length === 0
              ? <div className="py-1.5 text-ui text-ink-500">No linked projects.</div>
              : client.projects.map((p) => <ProjectRow key={p.id} project={p} />)}
          </section>

          {/* Invoices */}
          <section className="mt-10">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-h4 text-ink-900">Invoices</span>
              <span className="text-caption tabular-nums text-ink-500">{client.invoices.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => router.push('/money')}>New</Button>
            </div>
            {client.invoices.length === 0
              ? <div className="py-1.5 text-ui text-ink-500">Nothing billed yet.</div>
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

          {/* Forms — what we ask this client for (intake, feedback, testimonials). */}
          <FormsPanel forms={client.forms} clientId={client.id} />

          {/* Meetings — client conversations, the source of feedback. */}
          <section className="mt-10">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-h4 text-ink-900">Meetings</span>
              <span className="text-caption tabular-nums text-ink-500">{meetings.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={onNewMeeting}>New</Button>
            </div>
            {meetings.length === 0
              ? <div className="py-1.5 text-ui text-ink-500">No meetings logged. Capture a call, then pull the asks out as feedback.</div>
              : meetings.map((m) => {
                  const fbCount = feedback.filter((f) => f.meeting_id === m.id).length;
                  return (
                    <button key={m.id} type="button" onClick={() => onOpenMeeting(m.id)}
                      className="focus-ring flex w-full items-center gap-3 rounded-sm border-b border-line-soft py-2 text-left transition-colors last:border-0 hover:bg-surface-hover">
                      <Icon icon={MessageSquare} size={15} className="shrink-0 text-ink-400" />
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{m.title}</span>
                      {fbCount > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{fbCount} feedback</span>}
                      <span className="shrink-0 text-caption text-ink-500">{noteDate(m.met_at)}</span>
                    </button>
                  );
                })}
          </section>

          {/* Feedback — what this client has asked for (the fabric loop). */}
          <section className="mt-10">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-h4 text-ink-900">Feedback</span>
              <span className="text-caption tabular-nums text-ink-500">{feedback.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="ghost" icon={<Icon icon={MessageSquare} size={14} />} onClick={onLogFeedback}>Log</Button>
            </div>
            {feedback.length === 0
              ? <div className="py-1.5 text-ui text-ink-500">Nothing logged yet. Capture what they ask for — the highest-value asks rise to the top of Feedback.</div>
              : feedback.map((f) => {
                  const stake = f.deals.reduce((a, d) => a + d.value, 0);
                  return (
                    <div key={f.id} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                      <span className="shrink-0 tabular-nums text-caption text-ink-400">#{f.number}</span>
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{f.title}</span>
                      {stake > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{fmtMoney(stake)}</span>}
                      <Badge status={fbTone[f.status]}>{fbLabel[f.status]}</Badge>
                    </div>
                  );
                })}
          </section>

          {/* Notes / touch log */}
          <section className="mt-10">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-h4 text-ink-900">Notes</span>
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
              ? <div className="py-1 text-ui text-ink-500">No notes yet. The best CRM is the one you actually write in.</div>
              : client.notes.map((n) => (
                  <div key={n.id} className="border-b border-line-soft py-2.5 last:border-0">
                    <div className="mb-0.5 text-caption text-ink-500">{noteDate(n.created_at)}</div>
                    <div className="whitespace-pre-wrap text-pretty text-ui leading-relaxed text-ink-800">{n.body}</div>
                  </div>
                ))}
          </section>
      </div>
    </div>
  );
}

function ProjectRow({ project }: { project: ClientProject }) {
  return (
    <Link href={`/projects/${project.id}`}
      className="focus-ring group flex items-center gap-2.5 border-b border-line-soft py-2 last:border-0">
      <span aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ background: project.color ?? 'var(--color-ink-400)' }} />
      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{project.name}</span>
      <span className="tabular-nums text-caption text-ink-500">{project.open} open · {project.total}</span>
      <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-400 transition-colors group-hover:text-ink-600" />
    </Link>
  );
}

// ── Pipeline board ──────────────────────────────────────────────────────
function LeadCard({ lead, onAdvance, onBack, onWin, onCreateProject, onLogFeedback }: {
  lead: Lead; onAdvance: () => void; onBack: () => void; onWin: () => void; onCreateProject: () => void; onLogFeedback: () => void;
}) {
  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.id === lead.stage);
  return (
    <div className="group rounded-lg border border-line-soft bg-surface-raised p-3">
      <div className="mb-0.5 flex items-baseline gap-2">
        <div className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{lead.name}</div>
        {lead.value > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-700">{fmtMoney(lead.value)}</span>}
      </div>
      <div className="mb-1.5 text-caption text-ink-500">{[lead.contact, lead.source].filter(Boolean).join(' · ') || '—'}</div>
      {lead.note && <div className="mb-2 text-caption leading-relaxed text-ink-500">{lead.note}</div>}
      <div className="flex items-center gap-1.5">
        <span className="text-meta text-ink-500">{ageOf(lead.created_at)} in stage</span>
        <span className="flex-1" />
        <Button size="xs" variant="ghost" iconOnly icon={<Icon icon={MessageSquare} size={14} />} onClick={onLogFeedback} aria-label="Log feedback from this deal" className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" />
        {stageIdx > 0 && lead.stage !== 'won' && <Button size="xs" variant="ghost" iconOnly icon={<Icon icon={ChevronLeft} size={14} />} onClick={onBack} aria-label="Move back" />}
        {lead.stage === 'proposal'
          ? <Button size="xs" variant="primary" icon={<Icon icon={Check} size={14} />} onClick={onWin}>Won</Button>
          : lead.stage !== 'won' && <Button size="xs" variant="secondary" iconRight={<Icon icon={ChevronRight} size={14} />} onClick={onAdvance}>{PIPELINE_STAGES[stageIdx + 1].label}</Button>}
        {lead.stage === 'won' && <Button size="xs" variant="secondary" icon={<Icon icon={Kanban} size={14} />} onClick={onCreateProject}>Create project</Button>}
      </div>
    </div>
  );
}

function PipelineBoard({ leads, onMove, onNewLead, onCreateProject, onLogFeedback }: {
  leads: Lead[]; onMove: (id: string, stage: Stage) => void; onNewLead: () => void; onCreateProject: (lead: Lead) => void; onLogFeedback: (lead: Lead) => void;
}) {
  const { full } = useViewWidth();
  const advance = (l: Lead) => { const i = PIPELINE_STAGES.findIndex((s) => s.id === l.stage); if (i < PIPELINE_STAGES.length - 1) onMove(l.id, PIPELINE_STAGES[i + 1].id); };
  const back = (l: Lead) => { const i = PIPELINE_STAGES.findIndex((s) => s.id === l.stage); if (i > 0) onMove(l.id, PIPELINE_STAGES[i - 1].id); };
  const totalOpen = leads.filter((l) => l.stage !== 'won').reduce((a, l) => a + l.value, 0);

  return (
    <div className={cn('px-[clamp(18px,3vw,40px)] pb-16 pt-8', !full && 'mx-auto max-w-[1200px]')} style={{ animation: 'fadein 180ms' }}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-ui text-ink-500"><b className="tabular-nums text-ink-900">{fmtMoney(totalOpen)}</b> in open pipeline</span>
        <span className="flex-1" />
        <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={onNewLead}>New lead</Button>
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
                {sleads.length === 0 && <div className="rounded-md border border-dashed border-line-soft px-2 py-4 text-center text-caption text-ink-400">{stage.hint}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
export function ClientsView({ initialClients, initialLeads, initialFeedback = [], initialMeetings = [] }: { initialClients: ClientCard[]; initialLeads: Lead[]; initialFeedback?: FeedbackItem[]; initialMeetings?: MeetingItem[] }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [leads, setLeads] = useState(initialLeads);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [meetings, setMeetings] = useState(initialMeetings);
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);
  useEffect(() => { setClients(initialClients); }, [initialClients]);
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);
  useEffect(() => { setFeedback(initialFeedback); }, [initialFeedback]);
  useEffect(() => { setMeetings(initialMeetings); }, [initialMeetings]);

  const [tab, setTab] = useState<'clients' | 'pipeline' | 'feedback'>('clients');
  const [activeId, setActiveId] = useState<string | undefined>(initialClients[0]?.id);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [tasked, setTasked] = useState<Set<string>>(new Set());

  useEffect(() => { if (clients.length && !clients.find((c) => c.id === activeId)) setActiveId(clients[0].id); }, [clients, activeId]);

  const active = clients.find((c) => c.id === activeId) ?? clients[0];
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
    if ('error' in res) setTasked((s) => { const n = new Set(s); n.delete(c.id); return n; });
    else toast({ message: 'Added to Inbox', variant: 'info' });
  }
  async function addNote(c: ClientCard, body: string) {
    const tmp = 'tmp-' + Date.now();
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

  async function createClientRow(input: { name: string; role: string; contact: string; email: string }) {
    const tmp = 'tmp-' + Date.now();
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
    const tmp = 'tmp-' + Date.now();
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
  const [logForDeal, setLogForDeal] = useState<string | null>(null); // deal id to pre-link when logging from the pipeline
  const [logForClient, setLogForClient] = useState<string | null>(null); // client id when logging from a client's detail
  async function createFeedback(input: { title: string; dealIds: string[]; clientId?: string | null; source?: string; meetingId?: string | null }) {
    if (!input.title.trim()) return;
    const tmp = 'tmp-' + Date.now();
    const linked = deals.filter((d) => input.dealIds.includes(d.id));
    const nextNum = feedback.reduce((m, f) => Math.max(m, f.number), 0) + 1;
    setFeedback((fs) => [{ id: tmp, number: nextNum, title: input.title, body: null, status: 'open', source: input.source ?? 'manual', client_id: input.clientId ?? null, meeting_id: input.meetingId ?? null, task_id: null, created_at: new Date().toISOString(), deals: linked }, ...fs]);
    toast({ message: 'Feedback logged', variant: 'info' });
    const res = await addFeedback({ title: input.title, dealIds: input.dealIds, clientId: input.clientId ?? undefined, source: input.source, meetingId: input.meetingId ?? undefined });
    if ('error' in res) setFeedback((fs) => fs.filter((f) => f.id !== tmp));
    else setFeedback((fs) => fs.map((f) => (f.id === tmp ? { ...f, id: res.id, number: res.number } : f)));
  }

  // ── meeting mutations (the "2.2" card — conversations feedback comes from) ──
  async function createMeeting(clientId: string) {
    const tmp = 'tmp-' + Date.now();
    const now = new Date().toISOString();
    setMeetings((ms) => [{ id: tmp, client_id: clientId, title: 'Meeting', notes: null, met_at: now, created_at: now }, ...ms]);
    setOpenMeetingId(tmp);
    const res = await addMeeting({ clientId, title: 'Meeting' });
    if ('id' in res) { setMeetings((ms) => ms.map((m) => (m.id === tmp ? { ...m, id: res.id } : m))); setOpenMeetingId((id) => (id === tmp ? res.id : id)); }
    else { setMeetings((ms) => ms.filter((m) => m.id !== tmp)); setOpenMeetingId((id) => (id === tmp ? null : id)); }
  }
  function saveMeetingNotes(id: string, notes: string) {
    setMeetings((ms) => ms.map((m) => (m.id === id ? { ...m, notes } : m)));
    updateMeeting(id, { notes: notes.trim() || null });
  }
  async function removeMeeting(id: string) {
    setMeetings((ms) => ms.filter((m) => m.id !== id));
    setOpenMeetingId((cur) => (cur === id ? null : cur));
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

  return (
    <div className="flex h-full flex-col md:flex-row" style={{ animation: 'fadein 220ms' }}>
      {/* Rail */}
      <div className="w-full shrink-0 overflow-y-auto overflow-x-hidden border-b border-line-soft p-3.5 max-h-[42vh] md:h-full md:max-h-none md:w-60 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-title-4 text-ink-900">Clients</h2>
          <span className="flex-1" />
          {tab !== 'feedback' && (
            <Button size="xs" variant="ghost" iconOnly icon={<Icon icon={Plus} size={16} />}
              onClick={() => (tab === 'clients' ? setShowAddClient(true) : setShowAddLead(true))}
              aria-label={tab === 'clients' ? 'Add client' : 'Add lead'} />
          )}
        </div>
        <div className="mb-3.5">
          <SegmentedControl
            aria-label="Clients, pipeline, or feedback"
            value={tab}
            onValueChange={(t) => setTab(t as 'clients' | 'pipeline' | 'feedback')}
            options={[{ value: 'clients', label: 'Clients' }, { value: 'pipeline', label: 'Pipeline' }, { value: 'feedback', label: 'Feedback' }]}
          />
        </div>
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
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {tab === 'clients' ? (
          active ? (
            <ClientDetail
              client={active}
              tasked={tasked.has(active.id)}
              feedback={feedback.filter((f) => f.client_id === active.id && f.status !== 'declined')}
              meetings={meetings.filter((m) => m.client_id === active.id)}
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
                description="Add one to track health, next steps, projects, and notes."
                primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setShowAddClient(true)}>New client</Button>}
              />
            </div>
          )
        ) : tab === 'pipeline' ? (
          <PipelineBoard leads={leads} onMove={moveLead} onNewLead={() => setShowAddLead(true)} onCreateProject={createProjectFromLead} onLogFeedback={(lead) => setLogForDeal(lead.id)} />
        ) : (
          <FeedbackBoard items={feedback} deals={deals} onNew={createFeedback} onSetStatus={setFeedbackStatus} onShip={shipFeedbackItem} />
        )}
      </div>

      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onAdd={createClientRow} />}
      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} onAdd={createLead} />}
      {logForDeal && <AddFeedbackModal deals={deals} presetDealIds={[logForDeal]} onClose={() => setLogForDeal(null)} onAdd={(input) => createFeedback({ ...input, source: 'deal' })} />}
      {logForClient && <AddFeedbackModal deals={deals} onClose={() => setLogForClient(null)} onAdd={(input) => createFeedback({ ...input, clientId: logForClient, source: 'client' })} />}
      {openMeetingId && (() => {
        const m = meetings.find((x) => x.id === openMeetingId);
        return m ? (
          <MeetingPanel
            meeting={m}
            feedback={feedback.filter((f) => f.meeting_id === m.id)}
            onClose={() => setOpenMeetingId(null)}
            onSaveNotes={(n) => saveMeetingNotes(m.id, n)}
            onAddFeedback={(t) => createFeedback({ title: t, dealIds: [], clientId: m.client_id ?? undefined, source: 'meeting', meetingId: m.id })}
            onDelete={() => removeMeeting(m.id)}
          />
        ) : null;
      })()}
      <Toaster />
    </div>
  );
}
