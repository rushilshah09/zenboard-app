'use client';
// The client portal — a responsive dashboard app the client opens on a magic
// link. Rendered by both the public /portal/[token] route and the in-app
// "Preview as client" overlay from the SAME PortalView, so the two never drift.
//
// Shape: an app-shell (left sidebar nav on desktop, a sticky chip-nav on
// mobile) + a single content pane that switches between sections. The default
// "Overview" is the dashboard: a few generous stat cards + what needs the
// client's attention + the recent record. All read-only except the request
// form + approval decisions (token-scoped server actions).
//
// Design notes: responsive LAYOUT uses Tailwind classes (grid/flex/lg:) —
// inline styles can't do media queries — and every card is the app's own house
// card (`CARD` below: surface-raised, a hairline, radius lg). The portal is
// fully MONOCHROME by choice (no berry/accent washes) — the only colour is the
// semantic status Badge (paid/sent/overdue, approved/changes). Emphasis comes
// from the ink solid + type hierarchy, not a pink accent.
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  CheckCircle, Circle, FileText, Files, Send, Sparkles,
  LayoutGrid, Inbox, Receipt, List, ArrowRight, SquarePen, Megaphone,
} from '@/components/ds/icons';
import { Icon, Badge, Button, button, EmptyLine, type BadgeStatus, CARD_CLASS } from '@/components/ds/ui';
import type { IconType } from '@/lib/icons';
import { TextInput, Textarea } from '@/components/ds/ui';
import { submitClientRequest, submitClientReply, getClientRequestStatuses, submitApprovalDecision, signPortalFile } from '@/lib/actions/portal';
import { CLIENT_LABEL_TONE, type PortalRequestStatus } from '@/lib/request-status';
import { RequestThread, type ThreadMessage } from '@/components/portal/request-thread';
import type { PortalView, PortalInvoice, PortalApproval, PortalForm, PortalDoc, PortalAccept, PortalStream, PortalFile, PortalUpdate } from '@/lib/portal';
import { formatBytes } from '@/lib/attachments';
import { LineItemsBlock } from '@/components/documents/line-items-block';
import { AcceptBlock } from '@/components/documents/accept-block';
import { submitAcceptance } from '@/lib/actions/acceptance';
import type { Acceptance } from '@/lib/acceptance';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useServerState } from '@/lib/use-server-state';

// Browser-scoped tracking of the requests THIS visitor submitted (no login). The
// request id (a random uuid returned on submit) is the client's capability to
// see its own status later — stored per token so portals never mix.
const idsKey = (token: string) => `zb:portal:reqs:${token}`;
function readIds(token?: string): string[] {
  if (!token || typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(idsKey(token)) || '[]'); } catch { return []; }
}
function rememberId(token: string, id: string) {
  if (typeof window === 'undefined') return;
  const next = [id, ...readIds(token).filter((x) => x !== id)].slice(0, 100);
  try { localStorage.setItem(idsKey(token), JSON.stringify(next)); } catch { /* ignore */ }
}

const STATUS_TONE: Record<string, BadgeStatus> = { active: 'accent', paused: 'warning', completed: 'success', done: 'success', archived: 'neutral' };
const statusLabel = (s: string) => (s === 'done' ? 'Completed' : s.charAt(0).toUpperCase() + s.slice(1));
// Portal dates always carry the year: a client reading an invoice or a signed
// document has no session context to infer it from.
const fmtDate = (iso: string) => formatDay(iso, { year: true }) ?? '';

const INVOICE_TONE: Record<PortalInvoice['status'], BadgeStatus> = { sent: 'info', paid: 'success', overdue: 'danger' };
const invoiceLabel = (s: PortalInvoice['status']) => (s === 'overdue' ? 'Overdue' : s === 'paid' ? 'Paid' : 'Sent');
// A client reading their own invoice wants the exact figure, cents included.
const money = (n: number) => formatMoney(n, { exact: true });

type SectionId = 'overview' | 'updates' | 'approvals' | 'forms' | 'requests' | 'work' | 'invoices' | 'documents';
type NavItem = { id: SectionId; label: string; icon: IconType; count?: number };

// Shared small-caps section label (used inside Overview groups).
// Sentence case, like every label in the app — this is what a CLIENT reads, so
// it is the last place to be shouting. The tracking only ever existed to keep
// capitals legible, and went with them.
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 };

export function PortalDocument({ view, token, preview = false, demoStatuses, embedded = false }: { view: PortalView; token?: string; preview?: boolean; demoStatuses?: PortalRequestStatus[]; embedded?: boolean }) {
  // Request lifecycle state is lifted here so the nav badge, the Overview
  // summary, and the Requests section all read one source.
  const [requests, setRequests] = useState<PortalRequestStatus[]>(demoStatuses ?? []);
  const refreshRequests = useCallback(async () => {
    if (demoStatuses || preview || !token) return;
    const ids = readIds(token);
    // Nothing sent from this browser: the empty initial state already says so. Setting it again here was a
    // synchronous setState inside the mount effect (react-hooks/set-state-in-effect) for no change; ids only grow.
    if (ids.length === 0) return;
    setRequests(await getClientRequestStatuses(token, ids));
  }, [token, preview, demoStatuses]);
  // On arrival, fetch in the effect and set state in its callback — with a cleanup, so a portal closed before the
  // answer lands never sets it. `refreshRequests` is for after a submit, from the event that caused it.
  useEffect(() => {
    if (demoStatuses || preview || !token) return;
    const ids = readIds(token);
    if (ids.length === 0) return;
    let live = true;
    getClientRequestStatuses(token, ids).then((r) => { if (live) setRequests(r); });
    return () => { live = false; };
  }, [token, preview, demoStatuses]);
  const onSubmitted = (id: string) => { if (token) rememberId(token, id); refreshRequests(); };

  // Derived, section-agnostic counts.
  const awaitingCount = view.approvals?.filter((a) => a.status === 'awaiting').length ?? 0;
  const needsInputCount = requests.filter((r) => r.canReply).length;
  const unpaid = (view.invoices ?? []).filter((i) => i.status !== 'paid');
  const unpaidTotal = unpaid.reduce((s, i) => s + i.total, 0);

  // Nav is built from what's actually shared — hidden sections never appear.
  const nav = useMemo(() => ([
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    // Only when there is more than one: a single update already reads in full
    // on the Overview, and a nav item leading to the same paragraph is a door
    // into the room you are standing in.
    (view.updates?.length ?? 0) > 1 ? { id: 'updates', label: 'Updates', icon: Megaphone, count: view.updates!.length } : null,
    view.approvals ? { id: 'approvals', label: 'To review', icon: CheckCircle, count: awaitingCount || undefined } : null,
    view.forms ? { id: 'forms', label: 'Forms', icon: SquarePen, count: view.forms.length || undefined } : null,
    (view.allowRequests || requests.length) ? { id: 'requests', label: 'Requests', icon: Inbox, count: needsInputCount || undefined } : null,
    (view.open || view.completed || view.streams) ? { id: 'work', label: 'Work', icon: List } : null,
    view.invoices ? { id: 'invoices', label: 'Invoices', icon: Receipt, count: unpaid.length || undefined } : null,
    (view.docs || view.files) ? { id: 'documents', label: 'Documents', icon: Files } : null,
  ].filter(Boolean) as NavItem[]), [view, requests.length, awaitingCount, needsInputCount, unpaid.length]);

  const [active, setActive] = useState<SectionId>('overview');
  const go = (id: SectionId) => setActive(id);

  const initials = view.studio.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const sectionProps = { view, token, preview, requests, refreshRequests, onSubmitted, awaitingCount, unpaid, unpaidTotal, needsInputCount, go };

  return (
    <div className={cn('w-full lg:flex', !embedded && 'min-h-[100dvh]')} style={{ background: 'var(--canvas)', color: 'var(--ink)' }}>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:block lg:w-[248px] lg:shrink-0" style={{ borderRight: '1px solid var(--line-2)' }}>
        <div className={cn('flex flex-col gap-1 p-4', !embedded && 'sticky top-0 h-[100dvh]')}>
          <Brand initials={initials} studio={view.studio} className="px-2 pb-3 pt-2" />
          <nav className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
                className={cn(
                  'focus-ring flex h-9 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors',
                  active === item.id
                    ? 'font-medium text-[var(--ink)] bg-surface-active'
                    : 'text-[var(--text-secondary)] hover:text-[var(--ink)] hover:bg-surface-hover',
                )}
              >
                <Icon icon={item.icon} size={16} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.count ? <Count n={item.count} /> : null}
              </button>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-1.5 px-2 pt-4" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
            <Icon icon={Sparkles} size={12} /> Powered by Zenboard
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar + chip nav ───────────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-20" style={{ background: 'var(--canvas)', borderBottom: '1px solid var(--line-2)' }}>
        <div className="px-4 pt-4 pb-3"><Brand initials={initials} studio={view.studio} /></div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
              className={cn(
                'focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors',
                active === item.id
                  ? 'font-medium text-[var(--ink)] bg-surface-active [border-color:var(--line)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--ink)] hover:bg-surface-hover',
              )}
            >
              <Icon icon={item.icon} size={16} />
              {item.label}
              {item.count ? <Count n={item.count} /> : null}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[960px] px-4 py-7 sm:px-6 lg:px-12 lg:py-11">
          {active === 'overview' && <Overview {...sectionProps} />}
          {active === 'updates' && <UpdatesSection {...sectionProps} />}
          {active === 'approvals' && <ApprovalsSection {...sectionProps} />}
          {active === 'forms' && <FormsSection {...sectionProps} />}
          {active === 'requests' && <RequestsSection {...sectionProps} />}
          {active === 'work' && <WorkSection {...sectionProps} />}
          {active === 'invoices' && <InvoicesSection {...sectionProps} />}
          {active === 'documents' && <DocumentsSection {...sectionProps} />}
        </div>
      </main>
    </div>
  );
}

// Props threaded to every section. Kept as one bag so sections stay uniform.
type SP = {
  view: PortalView; token?: string; preview: boolean;
  requests: PortalRequestStatus[]; refreshRequests: () => void; onSubmitted: (id: string) => void;
  awaitingCount: number; unpaid: PortalInvoice[]; unpaidTotal: number; needsInputCount: number;
  go: (id: SectionId) => void;
};

// ── Brand (sidebar + mobile bar) ──────────────────────────────────────────
function Brand({ initials, studio, className }: { initials: string; studio: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center" style={{ borderRadius: 'var(--r-md)', background: 'var(--paper-3)', border: '1px solid var(--line)', fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--ink)' }}>{initials}</span>
      <span className="min-w-0 truncate" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{studio}</span>
    </div>
  );
}

// ── Small count pill on nav rows (monochrome) ─────────────────────────────
function Count({ n }: { n: number }) {
  return (
    <span
      className="num inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium leading-none"
      style={{ background: 'var(--paper-3)', color: 'var(--text-secondary)' }}
    >{n}</span>
  );
}

// ── Page header (section title + optional caption + action) ───────────────
function PageHeader({ title, caption, action, size = 'section' }: { title: string; caption?: string; action?: React.ReactNode; size?: 'page' | 'section' }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: size === 'page' ? 600 : 500, fontSize: size === 'page' ? 'var(--text-h1-size)' : 20, letterSpacing: '-0.015em', color: 'var(--ink)', margin: 0, lineHeight: 1.15 }}>{title}</h1>
        {caption && <p style={{ margin: '5px 0 0', fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{caption}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// A small-caps group inside a page (Overview uses these).
function Group({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 style={labelStyle}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="focus-ring touch-min inline-flex items-center gap-1 rounded-sm text-[12px] transition-colors" style={{ color: 'var(--text-secondary)' }}>
      View all <Icon icon={ArrowRight} size={12} />
    </button>
  );
}

// ── OVERVIEW — the dashboard ──────────────────────────────────────────────
function Overview({ view, token, preview, awaitingCount, unpaid, unpaidTotal, go }: SP) {
  const awaiting = (view.approvals ?? []).filter((a) => a.status === 'awaiting');
  const hasResolvedApprovals = (view.approvals?.length ?? 0) > awaiting.length;

  // Up to three generous stats, chosen from what's shared.
  const stats: React.ReactNode[] = [];
  if (view.progress) stats.push(<StatCard key="p" label="Progress" value={`${view.progress.pct}%`} meter={view.progress.pct} sub={`${view.progress.done} of ${view.progress.total} tasks complete`} />);
  if (view.approvals) stats.push(<StatCard key="a" label="Awaiting you" value={String(awaitingCount)} sub={awaitingCount ? 'to review' : "You're all caught up"} />);
  if (view.invoices) stats.push(<StatCard key="i" label="Balance due" value={money(unpaidTotal)} sub={unpaid.length ? `across ${unpaid.length} invoice${unpaid.length > 1 ? 's' : ''}` : 'Paid in full'} />);

  return (
    <div>
      <PageHeader size="page" title={view.projectName} action={<Badge status={STATUS_TONE[view.status] ?? 'neutral'}>{statusLabel(view.status)}</Badge>} />
      {view.intro && <p style={{ margin: '-8px 0 0', maxWidth: 640, fontSize: 'var(--text-body-lg-size)', lineHeight: 1.65, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{view.intro}</p>}

      {stats.length > 0 && (
        <div className={cn('mt-8 grid gap-3', stats.length >= 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : stats.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:max-w-sm')}>
          {stats}
        </div>
      )}

      {awaiting.length > 0 && (
        <Group title="To review" action={hasResolvedApprovals ? <ViewAll onClick={() => go('approvals')} /> : undefined}>
          <div className="grid gap-3">
            {awaiting.map((a) => <ApprovalCard key={a.id} approval={a} token={token} preview={preview} />)}
          </div>
        </Group>
      )}

      {(view.forms?.length ?? 0) > 0 && (
        <Group title="Forms to fill in">
          <div className="grid gap-3">
            {view.forms!.slice(0, 2).map((f) => <FormCard key={f.id} form={f} preview={preview} />)}
          </div>
        </Group>
      )}

      {/* What we SAID leads what we DID. A client opening this wants a sentence
          from a person before a list of finished tickets, and until now the
          list of finished tickets was all there was. */}
      {view.updates && view.updates.length > 0 && (
        <Group title="Latest update" action={view.updates.length > 1 ? <ViewAll onClick={() => go('updates')} /> : undefined}>
          <UpdateNote update={view.updates[0]} />
        </Group>
      )}

      {view.timeline && (
        <Group title="Recently completed">
          {view.timeline.length === 0 ? <Empty line="Nothing completed yet." /> : <TimelineList items={view.timeline.slice(0, 6)} />}
        </Group>
      )}
    </div>
  );
}

// ── The portal's card: the app's own ─────────────────────────────────────────
// Every card here is the house card — `bg-surface-raised`, a hairline, `rounded-lg` — the same object the studio
// sees in the app. They were `paper-2` fills on the portal's grey page at `r-xl` and `r-2xl`: a second, softer card
// language, so a client looked at a different product from the one their studio works in (audit, 2026-09-22).
const CARD = CARD_CLASS;

// ── Generous metric card ──────────────────────────────────────────────────
function StatCard({ label, value, sub, meter }: { label: string; value: string; sub?: string; meter?: number }) {
  return (
    <div className={cn(CARD, 'px-5 py-[18px]')}>
      <span style={labelStyle}>{label}</span>
      <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1-size)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)', marginTop: 12 }}>{value}</div>
      {meter != null && (
        <div style={{ marginTop: 12, height: 6, borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: 'var(--ink)', transform: `translateX(-${100 - Math.min(100, Math.max(0, meter))}%)`, transition: 'transform var(--duration-base) var(--ease-standard)' }} />
        </div>
      )}
      {sub && <div style={{ marginTop: 10, fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

// ── APPROVALS ─────────────────────────────────────────────────────────────
function ApprovalsSection({ view, token, preview }: SP) {
  const list = view.approvals ?? [];
  return (
    <div>
      <PageHeader title="To review" caption="Sign off on deliverables, or send notes on what to change." />
      {list.length === 0 ? <Empty line="Nothing to review right now." /> : (
        <div className="grid gap-3">{list.map((a) => <ApprovalCard key={a.id} approval={a} token={token} preview={preview} />)}</div>
      )}
    </div>
  );
}

// ── FORMS ─────────────────────────────────────────────────────────────────
function FormsSection({ view, preview }: SP) {
  const list = view.forms ?? [];
  return (
    <div>
      <PageHeader title="Forms" caption="Things we've asked you to fill in. No account needed." />
      {list.length === 0 ? <Empty line="Nothing to fill in right now." /> : (
        <div className="grid gap-3">{list.map((f) => <FormCard key={f.id} form={f} preview={preview} />)}</div>
      )}
    </div>
  );
}

/**
 * A form the client can open. It links out to the SAME public /f/[token] page
 * anyone else would use — one filling path, one security gate, no second
 * renderer to keep in sync.
 */
function FormCard({ form, preview }: { form: PortalForm; preview?: boolean }) {
  return (
    <div className={cn(CARD, 'px-[18px] py-4')}>
      <div className="flex items-center gap-2.5">
        <Icon icon={SquarePen} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span className="min-w-0 flex-1" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{form.title}</span>
      </div>
      {form.description && (
        <p style={{ margin: '8px 0 0', paddingLeft: 23, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)' }}>{form.description}</p>
      )}
      <div className="mt-3.5" style={{ paddingLeft: 23 }}>
        {preview ? (
          <Button variant="secondary" size="sm" disabled>Open the form</Button>
        ) : (
          // A real <a>, styled with the DS button cva. NOT <Button asChild>: this
          // Button renders its own <span> wrapper, so Radix Slot has no single
          // element to merge onto and throws (see zenboard-ds-gotchas).
          // Secondary: an action in a list of cards is one of several — a filled button on every card is no longer
          // the one thing to do (CLAUDE.md: one filled button per view).
          <a href={`/f/${form.token}`} className={button({ variant: 'secondary', size: 'sm' })}>
            Open the form
          </a>
        )}
      </div>
    </div>
  );
}

// ── REQUESTS ──────────────────────────────────────────────────────────────
function RequestsSection({ view, token, preview, requests, refreshRequests, onSubmitted }: SP) {
  const hasItems = requests.length > 0;
  return (
    <div>
      <PageHeader title="Requests" caption="Ask for anything — you'll see the status here as we respond." />
      {hasItems && (
        <div className="grid gap-3">
          {requests.map((it) => <StatusCard key={it.id} item={it} token={token} preview={preview} onReplied={refreshRequests} />)}
        </div>
      )}
      {view.allowRequests && (
        <Group title={hasItems ? 'Send another request' : 'Send a request'}>
          <RequestForm token={token} preview={preview} onSubmitted={onSubmitted} />
        </Group>
      )}
      {!hasItems && !view.allowRequests && <Empty line="No requests yet." />}
    </div>
  );
}

// ── WORK — workstreams first, then anything ungrouped ─────────────────────
//
// A workstream is the shape an agency's client already thinks in ("where are we
// on packaging?"), so it leads. Streams the studio kept internal never reach
// this component at all — lib/portal.ts does not fetch them — which is why
// there is no "hidden" affordance anywhere here to give one away.
//
// A project with no client-facing workstreams renders exactly as it did before
// they existed: one In progress list and one Completed list.
function WorkSection({ view }: SP) {
  const streams = view.streams ?? [];
  const open = view.open ?? [];
  const completed = view.completed ?? [];
  const empty = streams.length + open.length + completed.length === 0;
  // Only worth a heading of its own when there is something above it to be
  // distinguished FROM.
  const looseLabel = streams.length > 0;
  return (
    <div>
      <PageHeader title="Work" caption="Everything we're building for you, and what's already shipped." />
      {empty ? <Empty line="No tasks yet." /> : (
        <div className="grid gap-8">
          {streams.map((s) => <StreamGroup key={s.id} stream={s} />)}
          {open.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2"><h2 style={labelStyle}>{looseLabel ? 'Everything else' : 'In progress'}</h2><Count n={open.length} /></div>
              <div>{open.map((t) => <TaskRow key={t.id} title={t.title} />)}</div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2"><h2 style={labelStyle}>Completed</h2><Count n={completed.length} /></div>
              <div>{completed.map((t) => <TaskRow key={t.id} title={t.title} done />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// One workstream: its name, how far along it is, then its work — open first,
// because "what is happening" is the question, and finished items are the
// answer to a different one.
function StreamGroup({ stream: s }: { stream: PortalStream }) {
  const total = s.open.length + s.completed.length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 style={labelStyle}>{s.name}</h2>
        <Count n={total} />
        <span className="flex-1" />
        <span className="num" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
          {s.completed.length} of {total} done
        </span>
      </div>
      <div aria-hidden style={{ height: 3, borderRadius: 999, background: 'var(--line-2)', overflow: 'hidden' }}>
        <div style={{ width: `${s.pct}%`, height: '100%', background: 'var(--ink)' }} />
      </div>
      <div>
        {s.open.map((t) => <TaskRow key={t.id} title={t.title} />)}
        {s.completed.map((t) => <TaskRow key={t.id} title={t.title} done />)}
      </div>
    </div>
  );
}

function TaskRow({ title, done }: { title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: '11px 2px', borderTop: '1px solid var(--line-2)' }}>
      <Icon icon={done ? CheckCircle : Circle} size={16} style={{ color: done ? 'var(--green-text)' : 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ fontSize: 'var(--text-body-size)', color: done ? 'var(--text-secondary)' : 'var(--ink)' }}>{title}</span>
    </div>
  );
}

// ── UPDATES — the one section that is a person talking ─────────────────────
function UpdatesSection({ view }: SP) {
  const list = view.updates ?? [];
  return (
    <div>
      <PageHeader title="Updates" caption="Where things stand, in our words." />
      {list.length === 0 ? <Empty line="No updates yet." /> : (
        <div className="grid gap-6">{list.map((u) => <UpdateNote key={u.id} update={u} />)}</div>
      )}
    </div>
  );
}

// Prose, not a row. The date sits under the words rather than in a fixed column
// like the timeline's, because this is something to read, not something to scan.
function UpdateNote({ update: u }: { update: PortalUpdate }) {
  return (
    <div>
      <p style={{ margin: 0, maxWidth: 640, fontSize: 'var(--text-body-lg-size)', lineHeight: 1.65, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{u.body}</p>
      <div className="num" style={{ marginTop: 8, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{fmtDate(u.at)}</div>
    </div>
  );
}

function TimelineList({ items }: { items: NonNullable<PortalView['timeline']> }) {
  return (
    <div>
      {items.map((e, i) => (
        <div key={i} className="flex items-baseline gap-3.5" style={{ padding: '11px 2px', borderTop: '1px solid var(--line-2)' }}>
          <span className="num shrink-0" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)', width: 88 }}>{fmtDate(e.at)}</span>
          <span style={{ fontSize: 'var(--text-body-size)', color: 'var(--ink-2)' }}>{e.title}</span>
        </div>
      ))}
    </div>
  );
}

// ── INVOICES ──────────────────────────────────────────────────────────────
function InvoicesSection({ view, unpaidTotal }: SP) {
  const list = view.invoices ?? [];
  return (
    <div>
      <PageHeader title="Invoices" caption="Your billing history and anything still outstanding." action={unpaidTotal > 0 ? (
        <div className="text-right">
          <div style={labelStyle}>Balance due</div>
          <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{money(unpaidTotal)}</div>
        </div>
      ) : undefined} />
      {list.length === 0 ? <Empty line="No invoices yet." /> : (
        <div>
          {list.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3" style={{ padding: '13px 2px', borderTop: '1px solid var(--line-2)' }}>
              <span style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 'var(--text-small-size)', letterSpacing: '0.02em', color: 'var(--ink)' }}>{inv.number}</span>
              <Badge status={INVOICE_TONE[inv.status]}>{invoiceLabel(inv.status)}</Badge>
              <span className="flex-1" />
              {inv.dueDate && <span className="hidden sm:inline" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>Due {fmtDate(inv.dueDate)}</span>}
              <span className="num" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)', minWidth: 72, textAlign: 'right' }}>{money(inv.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DOCUMENTS ─────────────────────────────────────────────────────────────
function DocumentsSection({ view, token, preview }: SP) {
  const list = view.docs ?? [];
  const files = view.files ?? [];
  return (
    <div>
      <PageHeader title="Documents" caption="Files and notes shared with you." />
      {list.length === 0 && files.length === 0 ? <Empty line="No shared documents." /> : (
        <div className="grid gap-8">
          {list.length > 0 && (
            <div>{list.map((d) => <DocumentRow key={d.id} doc={d} token={token} preview={preview} />)}</div>
          )}
          {files.length > 0 && <FilesGroup files={files} token={token} preview={preview} />}
        </div>
      )}
    </div>
  );
}

// ── FILES ─────────────────────────────────────────────────────────────────
// Deliverables the studio uploaded. Shown under Documents rather than as a
// seventh nav item: to a client "the brief" and "the logo pack" are the same
// errand, and a nav that splits them by how they were authored is our filing
// again, not their project.
function FilesGroup({ files, token, preview }: { files: PortalFile[]; token?: string; preview?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(f: PortalFile) {
    // The preview is the owner looking at their own portal. Signing a real URL
    // there would work, but it is not what the client's click does, and this
    // component's whole contract is that the two are the same thing.
    if (preview || !token) { setError('File downloads open on the live portal.'); return; }
    setBusy(f.id); setError(null);
    const res = await signPortalFile(token, f.id);
    setBusy(null);
    if ('error' in res) { setError(res.error); return; }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2"><h2 style={labelStyle}>Files</h2><Count n={files.length} /></div>
      <div>
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3" style={{ padding: '11px 2px', borderTop: '1px solid var(--line-2)' }}>
            <Icon icon={Files} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{f.filename}</span>
            <span className="num shrink-0" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{formatBytes(f.size)}</span>
            <Button size="sm" variant="secondary" loading={busy === f.id} onClick={() => void open(f)}>Download</Button>
          </div>
        ))}
      </div>
      {error && <div role="status" style={{ marginTop: 8, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{error}</div>}
    </div>
  );
}

function DocumentRow({ doc: d, token, preview }: { doc: PortalDoc; token?: string; preview?: boolean }) {
  const paperwork = !!d.items || d.accepts.length > 0;
  return (
    <div style={{ padding: '14px 2px', borderTop: '1px solid var(--line-2)' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: d.text || paperwork ? 6 : 0 }}>
        <Icon icon={FileText} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{d.title}</span>
      </div>
      {d.text && <p style={{ margin: 0, paddingLeft: 23, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{d.text}</p>}

      {paperwork && (
        <div style={{ paddingLeft: 23, marginTop: 10 }}>
          {/* The same block components the owner authored with, read-only. A
              second portal-only rendering could show a different total or
              different wording from the document that was signed. */}
          {d.items && <LineItemsBlock items={d.items} onChange={() => {}} readOnly />}
          {d.accepts.map((a) => (
            <SignBlock key={a.blockId} pageId={d.id} accept={a} token={token} preview={preview} />
          ))}
        </div>
      )}
    </div>
  );
}

// The one write the portal makes to a document. `preview` is the owner looking
// at their own portal — the block renders exactly as the client sees it, but
// signing is refused, because a studio must not be able to accept on the
// client's behalf by clicking around in a preview.
function SignBlock({ pageId, accept, token, preview }: { pageId: string; accept: PortalAccept; token?: string; preview?: boolean }) {
  const [signed, setSigned] = useState<Acceptance | null>(accept.acceptance);
  return (
    <AcceptBlock
      terms={accept.terms}
      acceptance={signed}
      onAccept={async (name, email) => {
        if (preview) return { error: 'This is a preview — your client signs from their own link.' };
        if (!token) return { error: 'This link can’t record a signature.' };
        const res = await submitAcceptance(token, pageId, accept.blockId, name, email);
        if ('error' in res) return res;
        setSigned(res.acceptance);
        return { ok: true } as const;
      }}
    />
  );
}

// ── Client-actionable cards (unchanged logic) ─────────────────────────────
function StatusCard({ item, token, preview, onReplied }: { item: PortalRequestStatus; token?: string; preview?: boolean; onReplied: () => void }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  // A hint carries whether it is about the FIELD ("write something") or about
  // the link or the server. Only the first marks the textarea invalid — a red
  // box around text that is perfectly fine tells a screen reader the wrong thing.
  const [hint, setHint] = useState<{ text: string; field?: boolean } | null>(null);
  const replyId = useId();
  const [msgs, setMsgs] = useServerState(item.messages);

  const thread: ThreadMessage[] = msgs.map((m) => ({ author: m.author, body: m.body, createdAt: m.createdAt }));

  async function send() {
    const text = reply.trim();
    // EVERY WAY OUT OF THIS FUNCTION SAYS SOMETHING. It used to return silently
    // four ways — empty reply, the owner's preview, a link with no token, and a
    // server refusal — so a press could do nothing and explain nothing. The
    // empty case was invisible anyway: the button was disabled, and the DS
    // renders that as a pale wash, so the action read as absent.
    if (text.length < 1) { setHint({ text: 'Write a reply first.', field: true }); document.getElementById(replyId)?.focus(); return; }
    if (preview) { setHint({ text: 'This is a preview — your client replies from their own link.' }); return; }
    if (!token) { setHint({ text: 'This link can’t send a reply.' }); return; }
    setSending(true);
    const res = await submitClientReply(token, item.id, text);
    setSending(false);
    if ('error' in res) { setHint({ text: res.error }); return; }
    setMsgs((ms) => [...ms, { author: 'client', body: text, createdAt: new Date().toISOString() }]);
    setReply('');
    onReplied();
  }

  return (
    <div className={cn(CARD, 'px-[18px] py-4')}>
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{item.title}</span>
        <Badge status={CLIENT_LABEL_TONE[item.label] as BadgeStatus}>{item.label}</Badge>
      </div>

      {item.resolutionNote && (
        <div style={{ marginTop: 10, borderLeft: '2px solid var(--line)', paddingLeft: 12, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{item.resolutionNote}</div>
      )}

      {thread.length > 0 && <RequestThread messages={thread} className="mt-3" />}

      {item.canReply && (
        <div className="mt-3 grid gap-2">
          <Textarea id={replyId} value={reply} onChange={(e) => { setReply(e.target.value); if (hint) setHint(null); }}
            placeholder="Reply…" rows={3} aria-invalid={!!hint?.field} />
          {hint && <p role="alert" className="m-0 text-meta text-danger">{hint.text}</p>}
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={send} disabled={sending} icon={<Icon icon={Send} size={12} />}>{sending ? 'Sending…' : 'Reply'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ approval, token, preview }: { approval: PortalApproval; token?: string; preview?: boolean }) {
  const [status, setStatus] = useState(approval.status);
  const [note, setNote] = useState(approval.note);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // Same contract as the reply above: the button stays pressable, and every way
  // out of these two says something. A client deciding on work they are paying
  // for is the last person who should press a button and get silence.
  const [hint, setHint] = useState<{ text: string; field?: boolean } | null>(null);
  const draftId = useId();

  async function approve() {
    if (preview) { setHint({ text: 'This is a preview — your client approves from their own link.' }); return; }
    if (!token) { setHint({ text: 'This link can’t record a decision.' }); return; }
    setBusy(true);
    const res = await submitApprovalDecision(token, approval.id, 'approved');
    setBusy(false);
    if ('error' in res) { setHint({ text: res.error }); return; }
    setStatus('approved'); setNote(null); setAsking(false); setHint(null);
  }

  async function requestChanges() {
    const text = draft.trim();
    if (text.length < 2) { setHint({ text: 'Say what needs changing.', field: true }); document.getElementById(draftId)?.focus(); return; }
    if (preview) { setHint({ text: 'This is a preview — your client answers from their own link.' }); return; }
    if (!token) { setHint({ text: 'This link can’t record a decision.' }); return; }
    setBusy(true);
    const res = await submitApprovalDecision(token, approval.id, 'changes_requested', text);
    setBusy(false);
    if ('error' in res) { setHint({ text: res.error }); return; }
    setStatus('changes_requested'); setNote(text); setAsking(false); setDraft(''); setHint(null);
  }

  const resolved = status !== 'awaiting';
  const tone: BadgeStatus = status === 'approved' ? 'success' : status === 'changes_requested' ? 'warning' : 'info';
  const label = status === 'approved' ? 'Approved' : status === 'changes_requested' ? 'Changes requested' : 'Please review';

  return (
    <div className={cn(CARD, 'px-[18px] py-4')}>
      <div className="flex items-center gap-2.5">
        <Icon icon={FileText} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span className="min-w-0 flex-1" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{approval.title}</span>
        <Badge status={tone}>{label}</Badge>
      </div>

      {status === 'changes_requested' && note && (
        <div style={{ marginTop: 10, borderLeft: '2px solid var(--line)', paddingLeft: 12, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{note}</div>
      )}

      {!resolved && !asking && (
        <div className="mt-3.5 grid gap-2">
          <div className="flex gap-2">
            {/* Secondary, like "Request changes" beside it: two answers to one question, neither pushed. A filled
                Approve on every card in the list was also a filled button per card. */}
            <Button variant="secondary" size="sm" onClick={approve} disabled={busy} icon={<Icon icon={CheckCircle} size={14} />}>Approve</Button>
            <Button variant="secondary" size="sm" onClick={() => setAsking(true)}>Request changes</Button>
          </div>
          {hint && <p role="alert" className="m-0 text-meta text-danger">{hint.text}</p>}
        </div>
      )}

      {!resolved && asking && (
        <div className="mt-3 grid gap-2">
          <Textarea id={draftId} value={draft} onChange={(e) => { setDraft(e.target.value); if (hint) setHint(null); }}
            placeholder="What needs changing?" rows={3} aria-invalid={!!hint?.field} />
          {hint && <p role="alert" className="m-0 text-meta text-danger">{hint.text}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAsking(false); setDraft(''); setHint(null); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={requestChanges} disabled={busy} icon={<Icon icon={Send} size={12} />}>Send</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestForm({ token, preview, onSubmitted }: { token?: string; preview?: boolean; onSubmitted?: (id: string) => void }) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (preview || !token) return;
    const text = body.trim();
    if (text.length < 2) { setError('Please write a short message.'); return; }
    setState('sending'); setError(null);
    const res = await submitClientRequest(token, text, name);
    if ('error' in res) { setError(res.error); setState('idle'); }
    else { setState('sent'); setName(''); setBody(''); onSubmitted?.(res.id); }
  }

  if (state === 'sent') {
    return (
      <div className={cn(CARD, 'p-5 text-center')}>
        <Icon icon={CheckCircle} size={20} style={{ color: 'var(--green-text)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', color: 'var(--ink)', marginTop: 6 }}>Request sent.</div>
        <div style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', marginTop: 2 }}>You’ll see its status above as the team responds.</div>
        <div style={{ marginTop: 12 }}><Button variant="link" size="sm" onClick={() => setState('idle')}>Send another</Button></div>
      </div>
    );
  }

  return (
    <div className={cn(CARD, 'grid gap-2.5 p-3.5')}>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" autoComplete="off" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe your request…" rows={4} />
      {error && <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--red-text)' }}>{error}</div>}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{preview ? 'Preview — sending is disabled here.' : ''}</span>
        <Button variant="primary" size="sm" onClick={send} disabled={preview || state === 'sending'} icon={<Icon icon={Send} size={14} />}>{state === 'sending' ? 'Sending…' : 'Send'}</Button>
      </div>
    </div>
  );
}

// The portal's section-empty line is the app's, plus the rule above it that
// separates it from the section heading.
function Empty({ line }: { line: string }) {
  return <EmptyLine className="border-t border-line-soft py-4">{line}</EmptyLine>;
}
