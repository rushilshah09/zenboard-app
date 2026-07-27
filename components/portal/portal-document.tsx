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
// inline styles can't do media queries — while per-card COLOUR + GEOMETRY keeps
// the portal's token idiom (var(--paper-2) / --line / --r-*). The portal is
// fully MONOCHROME by choice (no berry/accent washes) — the only colour is the
// semantic status Badge (paid/sent/overdue, approved/changes). Emphasis comes
// from the ink solid + type hierarchy, not a pink accent.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Circle, FileText, Files, Send, Sparkles,
  LayoutGrid, Inbox, Receipt, List, ArrowRight, SquarePen,
} from '@/components/ds/icons';
import { Icon, Badge, Button, button, type BadgeStatus } from '@/components/ds/ui';
import type { IconType } from '@/lib/icons';
import { Input, Textarea } from '@/components/ui/primitives';
import { submitClientRequest, submitClientReply, getClientRequestStatuses, submitApprovalDecision } from '@/lib/actions/portal';
import { CLIENT_LABEL_TONE, type PortalRequestStatus } from '@/lib/request-status';
import { RequestThread, type ThreadMessage } from '@/components/portal/request-thread';
import type { PortalView, PortalInvoice, PortalApproval, PortalForm } from '@/lib/portal';
import { cn } from '@/lib/cn';

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
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const INVOICE_TONE: Record<PortalInvoice['status'], BadgeStatus> = { sent: 'info', paid: 'success', overdue: 'danger' };
const invoiceLabel = (s: PortalInvoice['status']) => (s === 'overdue' ? 'Overdue' : s === 'paid' ? 'Paid' : 'Sent');
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

type SectionId = 'overview' | 'approvals' | 'forms' | 'requests' | 'work' | 'invoices' | 'documents';
type NavItem = { id: SectionId; label: string; icon: IconType; count?: number };

// Shared small-caps section label (used inside Overview groups).
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-label-size)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0 };

export function PortalDocument({ view, token, preview = false, demoStatuses, embedded = false }: { view: PortalView; token?: string; preview?: boolean; demoStatuses?: PortalRequestStatus[]; embedded?: boolean }) {
  // Request lifecycle state is lifted here so the nav badge, the Overview
  // summary, and the Requests section all read one source.
  const [requests, setRequests] = useState<PortalRequestStatus[]>(demoStatuses ?? []);
  const refreshRequests = useCallback(async () => {
    if (demoStatuses || preview || !token) return;
    const ids = readIds(token);
    if (ids.length === 0) { setRequests([]); return; }
    setRequests(await getClientRequestStatuses(token, ids));
  }, [token, preview, demoStatuses]);
  useEffect(() => { refreshRequests(); }, [refreshRequests]);
  const onSubmitted = (id: string) => { if (token) rememberId(token, id); refreshRequests(); };

  // Derived, section-agnostic counts.
  const awaitingCount = view.approvals?.filter((a) => a.status === 'awaiting').length ?? 0;
  const needsInputCount = requests.filter((r) => r.canReply).length;
  const unpaid = (view.invoices ?? []).filter((i) => i.status !== 'paid');
  const unpaidTotal = unpaid.reduce((s, i) => s + i.total, 0);

  // Nav is built from what's actually shared — hidden sections never appear.
  const nav = useMemo(() => ([
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    view.approvals ? { id: 'approvals', label: 'To review', icon: CheckCircle, count: awaitingCount || undefined } : null,
    view.forms ? { id: 'forms', label: 'Forms', icon: SquarePen, count: view.forms.length || undefined } : null,
    (view.allowRequests || requests.length) ? { id: 'requests', label: 'Requests', icon: Inbox, count: needsInputCount || undefined } : null,
    (view.open || view.completed) ? { id: 'work', label: 'Work', icon: List } : null,
    view.invoices ? { id: 'invoices', label: 'Invoices', icon: Receipt, count: unpaid.length || undefined } : null,
    view.docs ? { id: 'documents', label: 'Documents', icon: Files } : null,
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
                    ? 'font-medium text-[var(--ink)] [background:var(--paper-2)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--ink)] hover:[background:var(--paper)]',
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
                  ? 'font-medium text-[var(--ink)] [background:var(--paper-2)] [border-color:var(--line)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--ink)]',
              )}
            >
              <Icon icon={item.icon} size={15} />
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
    <button onClick={onClick} className="focus-ring inline-flex items-center gap-1 rounded-sm text-[12px] transition-colors" style={{ color: 'var(--text-secondary)' }}>
      View all <Icon icon={ArrowRight} size={13} />
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

      {view.timeline && (
        <Group title="Recent updates">
          {view.timeline.length === 0 ? <Empty line="No updates yet." /> : <TimelineList items={view.timeline.slice(0, 6)} />}
        </Group>
      )}
    </div>
  );
}

// ── Generous metric card ──────────────────────────────────────────────────
function StatCard({ label, value, sub, meter }: { label: string; value: string; sub?: string; meter?: number }) {
  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-2xl)', padding: '18px 20px' }}>
      <span style={labelStyle}>{label}</span>
      <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1-size)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)', marginTop: 12 }}>{value}</div>
      {meter != null && (
        <div style={{ marginTop: 12, height: 6, borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${meter}%`, background: 'var(--ink)', transition: 'width 300ms' }} />
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
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: '16px 18px' }}>
      <div className="flex items-center gap-2.5">
        <Icon icon={SquarePen} size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span className="min-w-0 flex-1" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{form.title}</span>
      </div>
      {form.description && (
        <p style={{ margin: '8px 0 0', paddingLeft: 23, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)' }}>{form.description}</p>
      )}
      <div className="mt-3.5" style={{ paddingLeft: 23 }}>
        {preview ? (
          <Button variant="primary" size="sm" disabled>Open the form</Button>
        ) : (
          // A real <a>, styled with the DS button cva. NOT <Button asChild>: this
          // Button renders its own <span> wrapper, so Radix Slot has no single
          // element to merge onto and throws (see zenboard-ds-gotchas).
          <a href={`/f/${form.token}`} className={button({ variant: 'primary', size: 'sm' })}>
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

// ── WORK — open + completed, grouped ──────────────────────────────────────
function WorkSection({ view }: SP) {
  const open = view.open ?? [];
  const completed = view.completed ?? [];
  const empty = open.length + completed.length === 0;
  return (
    <div>
      <PageHeader title="Work" caption="Everything we're building for you, and what's already shipped." />
      {empty ? <Empty line="No tasks yet." /> : (
        <div className="grid gap-8">
          {open.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2"><h2 style={labelStyle}>In progress</h2><Count n={open.length} /></div>
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

function TaskRow({ title, done }: { title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: '11px 2px', borderTop: '1px solid var(--line-2)' }}>
      <Icon icon={done ? CheckCircle : Circle} size={16} style={{ color: done ? 'var(--green-text)' : 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ fontSize: 'var(--text-body-size)', color: done ? 'var(--text-secondary)' : 'var(--ink)' }}>{title}</span>
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
function DocumentsSection({ view }: SP) {
  const list = view.docs ?? [];
  return (
    <div>
      <PageHeader title="Documents" caption="Files and notes shared with you." />
      {list.length === 0 ? <Empty line="No shared documents." /> : (
        <div>
          {list.map((d) => (
            <div key={d.id} style={{ padding: '14px 2px', borderTop: '1px solid var(--line-2)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: d.text ? 6 : 0 }}>
                <Icon icon={FileText} size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{d.title}</span>
              </div>
              {d.text && <p style={{ margin: 0, paddingLeft: 23, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{d.text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Client-actionable cards (unchanged logic) ─────────────────────────────
function StatusCard({ item, token, preview, onReplied }: { item: PortalRequestStatus; token?: string; preview?: boolean; onReplied: () => void }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState(item.messages);
  useEffect(() => setMsgs(item.messages), [item.messages]);

  const thread: ThreadMessage[] = msgs.map((m) => ({ author: m.author, body: m.body, createdAt: m.createdAt }));

  async function send() {
    if (preview || !token) return;
    const text = reply.trim();
    if (text.length < 1) return;
    setSending(true);
    const res = await submitClientReply(token, item.id, text);
    setSending(false);
    if ('error' in res) return;
    setMsgs((ms) => [...ms, { author: 'client', body: text, createdAt: new Date().toISOString() }]);
    setReply('');
    onReplied();
  }

  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: '16px 18px' }}>
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
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" rows={3} />
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={send} disabled={preview || sending || reply.trim().length < 1} icon={<Icon icon={Send} size={13} />}>{sending ? 'Sending…' : 'Reply'}</Button>
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

  async function approve() {
    if (preview || !token) return;
    setBusy(true);
    const res = await submitApprovalDecision(token, approval.id, 'approved');
    setBusy(false);
    if ('error' in res) return;
    setStatus('approved'); setNote(null); setAsking(false);
  }

  async function requestChanges() {
    if (preview || !token) return;
    const text = draft.trim();
    if (text.length < 2) return;
    setBusy(true);
    const res = await submitApprovalDecision(token, approval.id, 'changes_requested', text);
    setBusy(false);
    if ('error' in res) return;
    setStatus('changes_requested'); setNote(text); setAsking(false); setDraft('');
  }

  const resolved = status !== 'awaiting';
  const tone: BadgeStatus = status === 'approved' ? 'success' : status === 'changes_requested' ? 'warning' : 'info';
  const label = status === 'approved' ? 'Approved' : status === 'changes_requested' ? 'Changes requested' : 'Please review';

  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: '16px 18px' }}>
      <div className="flex items-center gap-2.5">
        <Icon icon={FileText} size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span className="min-w-0 flex-1" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>{approval.title}</span>
        <Badge status={tone}>{label}</Badge>
      </div>

      {status === 'changes_requested' && note && (
        <div style={{ marginTop: 10, borderLeft: '2px solid var(--line)', paddingLeft: 12, fontSize: 'var(--text-small-size)', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{note}</div>
      )}

      {!resolved && !asking && (
        <div className="mt-3.5 flex gap-2">
          <Button variant="primary" size="sm" onClick={approve} disabled={preview || busy} icon={<Icon icon={CheckCircle} size={14} />}>Approve</Button>
          <Button variant="outline" size="sm" onClick={() => setAsking(true)} disabled={preview}>Request changes</Button>
        </div>
      )}

      {!resolved && asking && (
        <div className="mt-3 grid gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What needs changing?" rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAsking(false); setDraft(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={requestChanges} disabled={preview || busy || draft.trim().length < 2} icon={<Icon icon={Send} size={13} />}>Send</Button>
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
      <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: 20, textAlign: 'center' }}>
        <Icon icon={CheckCircle} size={20} style={{ color: 'var(--green-text)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', color: 'var(--ink)', marginTop: 6 }}>Request sent.</div>
        <div style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', marginTop: 2 }}>You’ll see its status above as the team responds.</div>
        <div style={{ marginTop: 12 }}><Button variant="link" size="sm" onClick={() => setState('idle')}>Send another</Button></div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: 14, display: 'grid', gap: 10 }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" autoComplete="off" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe your request…" rows={4} />
      {error && <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--red-text)' }}>{error}</div>}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{preview ? 'Preview — sending is disabled here.' : ''}</span>
        <Button variant="primary" size="sm" onClick={send} disabled={preview || state === 'sending'} icon={<Icon icon={Send} size={14} />}>{state === 'sending' ? 'Sending…' : 'Send'}</Button>
      </div>
    </div>
  );
}

function Empty({ line }: { line: string }) {
  return <div style={{ padding: '18px 2px', fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', borderTop: '1px solid var(--line-2)' }}>{line}</div>;
}
