'use client';
// Feedback board — the loop engine (MASTER_PRODUCT_PLAN.md, "fabric" layer).
// Customer signal, made durable and ranked by the money behind it: each item
// shows the Σ value of the deals that want it, so the top of the "Open" column
// is literally the highest-revenue thing you could build next. "Ship it" turns
// a feedback item into a task (the work) and advances it — closing the
// talk → feedback → ship → close-deal loop. One filled-accent button per view.
import { useMemo, useState } from 'react';
import { MessageSquare, Plus, Rocket, Check, ArrowRight } from '@/components/ds/icons';
import {
  Icon, Button, EmptyState, Modal, Field, TextInput,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  type BadgeStatus,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined';

// Shared status → badge tone/label (used by the board, client detail, meeting panel).
export const FEEDBACK_TONE: Record<FeedbackStatus, BadgeStatus> = { open: 'neutral', planned: 'info', in_progress: 'info', shipped: 'success', declined: 'neutral' };
export const FEEDBACK_LABEL: Record<FeedbackStatus, string> = { open: 'Open', planned: 'Planned', in_progress: 'In progress', shipped: 'Shipped', declined: 'Declined' };
export type FeedbackDeal = { id: string; name: string; value: number };
export type FeedbackItem = {
  id: string; number: number; title: string; body: string | null;
  status: FeedbackStatus; source: string | null; task_id: string | null;
  client_id?: string | null; meeting_id?: string | null; created_at?: string | null; deals: FeedbackDeal[];
};

const COLUMNS: { id: Exclude<FeedbackStatus, 'declined'>; label: string; hint: string }[] = [
  { id: 'open', label: 'Open', hint: 'Not triaged yet' },
  { id: 'planned', label: 'Planned', hint: 'Decided to build' },
  { id: 'in_progress', label: 'In progress', hint: 'Being built' },
  { id: 'shipped', label: 'Shipped', hint: 'Delivered' },
];

const money = (n: number) =>
  n >= 1000 ? '$' + (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k' : '$' + n;

const dealValue = (f: FeedbackItem) => f.deals.reduce((a, d) => a + d.value, 0);

// ── One feedback card ───────────────────────────────────────────────────────
function FeedbackCard({ item, onAdvance, onShip, onDecline, onReopen }: {
  item: FeedbackItem;
  onAdvance: () => void; onShip: () => void; onDecline: () => void; onReopen: () => void;
}) {
  const stake = dealValue(item);
  const rest = [
    item.deals.length ? `${item.deals.length} deal${item.deals.length === 1 ? '' : 's'}` : null,
    item.source && item.source !== 'manual' ? item.source : null,
  ].filter(Boolean).join(' · ');
  // "Ship it" stays a filled Rocket to mark the loop's hinge; every forward
  // action is secondary so the page keeps a single primary ("New feedback").
  const forward =
    item.status === 'open' ? { label: 'Plan', icon: ArrowRight as typeof ArrowRight, run: onAdvance }
    : item.status === 'planned' ? { label: 'Ship it', icon: Rocket, run: onShip }
    : item.status === 'in_progress' ? { label: 'Mark shipped', icon: Check, run: onAdvance }
    : null;

  return (
    <div className="group rounded-lg border border-line-soft bg-surface-raised p-3 transition-colors hover:border-line">
      <div className="flex items-start gap-2">
        <span className="mt-px shrink-0 tabular-nums text-meta text-ink-400">#{item.number}</span>
        <p className="min-w-0 flex-1 text-ui text-ink-900">{item.title}</p>
      </div>
      {(stake > 0 || rest) && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 pl-6 text-meta">
          {stake > 0 && (
            <span className="tabular-nums font-medium text-ink-700" title={`${item.deals.length} deal${item.deals.length === 1 ? '' : 's'} want this`}>{money(stake)}</span>
          )}
          {rest && <span className="text-ink-400">{stake > 0 ? `· ${rest}` : rest}</span>}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 pl-6">
        {item.status === 'shipped' ? (
          <span className="inline-flex items-center gap-1 text-meta text-success-700"><Icon icon={Check} size={13} /> Shipped</span>
        ) : forward && (
          <Button size="xs" variant="secondary" iconRight={<Icon icon={forward.icon} size={13} />} onClick={forward.run}>
            {forward.label}
          </Button>
        )}
        <span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="ghost" className="opacity-0 group-hover:opacity-100" aria-label="More actions">⋯</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.status !== 'open' && <DropdownMenuItem onSelect={onReopen}>Move to open</DropdownMenuItem>}
            {item.status !== 'shipped' && <DropdownMenuItem onSelect={onDecline}>Decline</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Add-feedback modal (with optional deal linking — the revenue rollup) ─────
// Exported so the pipeline board can log feedback pre-linked to a specific deal.
export function AddFeedbackModal({ deals, onClose, onAdd, presetDealIds }: {
  deals: FeedbackDeal[];
  onClose: () => void;
  onAdd: (input: { title: string; dealIds: string[] }) => void;
  presetDealIds?: string[];
}) {
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set(presetDealIds ?? []));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const stake = deals.filter((d) => picked.has(d.id)).reduce((a, d) => a + d.value, 0);

  const submit = () => { if (!title.trim()) return; onAdd({ title: title.trim(), dealIds: [...picked] }); onClose(); };
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title="Log feedback"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!title.trim()} onClick={submit}>Log feedback</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="What did they ask for?">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !deals.length) submit(); }} placeholder="Add usage-based pricing" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        {deals.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-caption font-medium text-ink-700">Deals that want this</span>
              {stake > 0 && <span className="tabular-nums text-caption text-ink-500">{money(stake)} at stake</span>}
            </div>
            <div className="max-h-44 overflow-y-auto overflow-x-hidden rounded-md border border-line-soft">
              {deals.map((d) => (
                <button key={d.id} type="button" onClick={() => toggle(d.id)}
                  className={cn('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui transition-colors hover:bg-surface-hover', picked.has(d.id) && 'bg-surface-hover')}>
                  <span className={cn('grid size-4 shrink-0 place-items-center rounded border', picked.has(d.id) ? 'border-accent bg-accent text-white' : 'border-line')}>
                    {picked.has(d.id) && <Icon icon={Check} size={11} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-900">{d.name}</span>
                  <span className="shrink-0 tabular-nums text-meta text-ink-500">{money(d.value)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
export function FeedbackBoard({ items, deals, onNew, onSetStatus, onShip }: {
  items: FeedbackItem[];
  deals: FeedbackDeal[];
  onNew: (input: { title: string; dealIds: string[] }) => void;
  onSetStatus: (id: string, status: FeedbackStatus) => void;
  onShip: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const live = useMemo(() => items.filter((i) => i.status !== 'declined'), [items]);

  const openStake = live.filter((i) => i.status === 'open' || i.status === 'planned').reduce((a, i) => a + dealValue(i), 0);
  const shipped = live.filter((i) => i.status === 'shipped').length;

  const advance: Record<string, FeedbackStatus> = { open: 'planned', in_progress: 'shipped' };

  return (
    <div className="flex h-full flex-col p-6" style={{ animation: 'fadein 220ms' }}>
      {/* Header row */}
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-title-4 text-ink-900">Feedback</h2>
        <span className="flex-1" />
        <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setShowAdd(true)}>New feedback</Button>
      </div>
      <p className="mb-4 text-ui text-ink-500">
        What customers are asking for, ranked by the deals that want it — build the top of the list first.
      </p>
      {/* Property strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ui text-ink-500">
        <span className="tabular-nums text-ink-700">{live.filter((i) => i.status !== 'shipped').length}</span> open
        <span className="text-ink-300">·</span>
        <span className="tabular-nums text-ink-700">{money(openStake)}</span> at stake
        <span className="text-ink-300">·</span>
        <span className="tabular-nums text-ink-700">{shipped}</span> shipped
      </div>

      {live.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <EmptyState
            illustration={<Icon icon={MessageSquare} size={20} />}
            title="No feedback yet"
            description="Log what customers ask for. Link the deals that want it, then ship the ones worth the most."
            primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setShowAdd(true)}>Log feedback</Button>}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colItems = live
              .filter((i) => i.status === col.id)
              .sort((a, b) => dealValue(b) - dealValue(a)); // money-first
            const colStake = colItems.reduce((a, i) => a + dealValue(i), 0);
            return (
              <div key={col.id} className={cn('flex min-h-40 flex-col rounded-lg border p-2', col.id === 'shipped' ? 'border-success-300 bg-success-100' : 'border-line-soft bg-surface-sunken')}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="text-ui font-medium text-ink-900">{col.label}</span>
                  <span className="tabular-nums text-caption text-ink-500">{colItems.length}</span>
                  <span className="flex-1" />
                  {colStake > 0 && <span className="tabular-nums text-caption text-ink-500">{money(colStake)}</span>}
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
                  {colItems.map((i) => (
                    <FeedbackCard key={i.id} item={i}
                      onAdvance={() => onSetStatus(i.id, advance[i.status] ?? i.status)}
                      onShip={() => onShip(i.id)}
                      onDecline={() => onSetStatus(i.id, 'declined')}
                      onReopen={() => onSetStatus(i.id, 'open')}
                    />
                  ))}
                  {colItems.length === 0 && (
                    <div className="rounded-md border border-dashed border-line-soft px-2 py-4 text-center text-caption text-ink-400">{col.hint}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddFeedbackModal deals={deals} onClose={() => setShowAdd(false)} onAdd={onNew} />}
    </div>
  );
}
