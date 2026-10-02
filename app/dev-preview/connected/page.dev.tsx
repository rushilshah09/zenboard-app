'use client';
// Dev-only harness for the Connected panel (§3.4). The panel normally fetches
// through the browser client, which returns nothing without a session — so this
// feeds it pre-built groups via the `groups` prop and exercises every shape the
// projection can emit: a plain edge, an indirect one (`via`), a metered one
// (`meta`), a group past the collapse threshold, an @-mention with its context
// sentence, and a tombstone whose target was deleted. 404s in prod.
import { notFound } from 'next/navigation';
import { ConnectedPanel } from '@/components/connected/connected-panel';
import { groupEdges, recordHref, type ConnectedEdge, type EntityType } from '@/lib/connected';

// Links come from `recordHref`, not hand-rolled here — otherwise the harness can
// show links the app doesn't actually have (or miss ones it does).
const e = (
  type: EntityType, id: string, label: string, o: Partial<ConnectedEdge> = {},
): ConnectedEdge => ({
  key: `${o.origin ?? 'structural'}:${type}:${id}:${o.via ?? ''}`,
  type, id, label, origin: 'structural',
  // A tombstone gets no href — mirroring mentionEdges, which only links a target
  // it managed to resolve. Linking to a deleted record is worse than not linking.
  href: o.tombstone ? undefined : recordHref(type, id),
  ...o,
});

// A task deep inside a client engagement — the case the panel exists for.
const taskEdges: ConnectedEdge[] = [
  e('project', 'p1', 'Acme rebrand', { meta: 'Active' }),
  e('client', 'c1', 'Meridian Studio', { via: 'Acme rebrand' }),
  e('goal', 'g1', 'Two retainer clients by Q4', { meta: 'Year' }),
  e('task', 't-parent', 'Ship the new identity', { meta: 'Parent' }),
  e('task', 's1', 'Draft wordmark options'),
  e('task', 's2', 'Pick three for review', { meta: 'Done' }),
  e('invoice', 'i1', 'INV-014', { meta: 'Paid', via: 'billed time' }),
  e('doc', 'd1', 'Brand direction v3', {
    origin: 'mention', key: 'mention:m1',
    context: 'Waiting on the wordmark before we lock type.',
  }),
  e('doc', 'gone', 'Deleted', { origin: 'mention', key: 'mention:m2', tombstone: true }),
];

// A client — the richest node in the graph (§7L), and the one that proves the
// per-group collapse actually collapses.
const clientEdges: ConnectedEdge[] = [
  e('project', 'p1', 'Acme rebrand', { meta: 'Active' }),
  e('project', 'p2', 'Website refresh', { meta: 'Done' }),
  e('invoice', 'i1', 'INV-014', { meta: 'Paid' }),
  e('invoice', 'i2', 'INV-018', { meta: 'Overdue' }),
  e('doc', 'd1', 'Brand direction v3'),
  e('meeting', 'm1', 'Kickoff call', { meta: '2 Jun' }),
  e('form', 'f1', 'Project intake', { meta: 'Live' }),
  ...Array.from({ length: 7 }, (_, i) =>
    e('task', `ct${i}`, `Open task ${i + 1}`, { via: i % 2 ? 'Website refresh' : 'Acme rebrand' })),
];

export default function ConnectedPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', padding: 32 }}>
      {/* min() so the harness itself never forces horizontal scroll on a phone —
          an overflowing wrapper makes every overflow audit report a false hit. */}
      <div style={{ display: 'grid', gap: 48, maxWidth: 900, gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
        <div data-h="task">
          <h2 style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>On a task</h2>
          <ConnectedPanel self={{ type: 'task', id: 't1' }} groups={groupEdges(taskEdges, { type: 'task', id: 't1' })} />
        </div>
        <div data-h="client">
          <h2 style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>On a client</h2>
          <ConnectedPanel self={{ type: 'client', id: 'c1' }} groups={groupEdges(clientEdges, { type: 'client', id: 'c1' })} />
        </div>
        <div data-h="drawer">
          <h2 style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>In the task drawer (tasks omitted &mdash; it lists them itself)</h2>
          <ConnectedPanel
            self={{ type: 'task', id: 't1' }}
            groups={groupEdges(taskEdges, { type: 'task', id: 't1' }, ['task'])}
          />
        </div>
        <div data-h="empty">
          <h2 style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Nothing connected (renders nothing)</h2>
          <ConnectedPanel self={{ type: 'task', id: 't9' }} groups={[]} />
        </div>
      </div>
    </div>
  );
}
