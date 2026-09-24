'use client';
// "Waiting for" — a task's dependencies (master plan §7B, migration 0032).
//
// WHY THIS IS NOT IN THE CONNECTED PANEL, which is where §7B's Connected line
// puts "blocking links". A dependency is always task↔task, and the drawer
// deliberately omits the `task` group from Connected (subtasks have their own
// section, the parent is in the breadcrumb — repeating both would be noise).
// Reviving that group just to carry one edge type would undo a decision made
// for good reasons, so a dependency gets its own home in the chip row instead.
// Connected still shows them on any host that is not the task itself.
//
// BENCHMARK (rule 7). Linear offers four relation types (blocks / blocked by /
// relates to / duplicates) on a dedicated issue section; Asana has dependencies
// plus dependents and notifies on unblock; Things and Todoist have none at all,
// deliberately. Ours is ONE edge in a chip: "relates to" is what the mentions
// fabric already does (§3.4) and "duplicates" is a decision rather than a
// relationship. Where we match Linear: it does not stop you completing a
// blocked issue, and neither do we — the flag is information, not a lock.
import * as React from 'react';
import { X, Check, Circle, Search } from '@/components/ds/icons';
import { Icon, MenuField } from '@/components/ds/ui';
import { createClient } from '@/lib/supabase/client';
import { searchRecords, type RecordHit } from '@/lib/search';
import { Pop, chipClass, popRow, popLabel, POP_ROW_CLASS } from '@/components/task-detail/chip-ui';
import { checkLink, REFUSAL_TEXT, type TaskLink } from '@/lib/task-links';

export type Blocker = { id: string; title: string; done: boolean };

export function BlockersChip({
  taskId, blockers, links, onAdd, onRemove,
}: {
  taskId: string;
  /** The tasks this one waits for, resolved to titles. */
  blockers: Blocker[];
  /** The WHOLE graph — the cycle check needs edges this task cannot see. */
  links: TaskLink[];
  onAdd: (blocker: Blocker) => void;
  onRemove: (blockerId: string) => void;
}) {
  const open = blockers.filter((b) => !b.done).length;
  const label = blockers.length === 0
    ? 'Waiting for'
    : open > 0
      ? `Blocked by ${open}`
      // Every prerequisite landed. Saying "Blocked by 0" would be a small lie
      // and saying nothing would hide that the dependency still exists.
      : `Waiting for ${blockers.length}`;

  return (
    <Pop
      width={268}
      label="Waiting for"
      trigger={(_o, p) => (
        <button {...p} className={chipClass(blockers.length > 0)} aria-label={blockers.length ? label : 'Add a task this one waits for'}>
          {open > 0
            ? <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
            : <Icon icon={Circle} size={12} />}
          {label}
        </button>
      )}
    >
      {() => (
        <BlockersMenu
          taskId={taskId} blockers={blockers} links={links}
          onAdd={onAdd} onRemove={onRemove}
        />
      )}
    </Pop>
  );
}

function BlockersMenu({
  taskId, blockers, links, onAdd, onRemove,
}: {
  taskId: string; blockers: Blocker[]; links: TaskLink[];
  onAdd: (blocker: Blocker) => void;
  onRemove: (blockerId: string) => void;
}) {
  const [term, setTerm] = React.useState('');
  // The results AND the term they answer, as one value. "Searching" is then
  // derived rather than stored — a separate boolean would have to be cleared in
  // the effect body, which is a cascading render, and it can also drift out of
  // step with the results it describes.
  const [result, setResult] = React.useState<{ term: string; hits: RecordHit[] }>({ term: '', hits: [] });
  const supabase = React.useMemo(() => createClient(), []);

  const q = term.trim();
  const hits = result.term === q ? result.hits : [];
  const searching = q !== '' && result.term !== q;

  // Debounced, and every response checks it is still the newest before it
  // renders — without that, a slow query for "de" can land after a fast one for
  // "design" and replace the right answers with stale ones.
  const seq = React.useRef(0);
  React.useEffect(() => {
    if (!q) return;   // nothing to search; the render already guards on `term`
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const found = await searchRecords(supabase, q, { types: ['task'], limit: 6 });
      if (seq.current !== mine) return;
      setResult({ term: q, hits: found });
    }, 160);
    return () => clearTimeout(t);
  }, [q, supabase]);

  const add = (hit: RecordHit) => {
    onAdd({ id: hit.id, title: hit.title, done: false });
    setTerm('');
  };

  return (
    <div>
      {blockers.length > 0 && (
        <>
          <span style={popLabel}>This task waits for</span>
          {blockers.map((b) => (
            <div key={b.id} className={POP_ROW_CLASS} style={{ ...popRow, cursor: 'default' }}>
              {/* Done vs open is the whole point of the list: it says which
                  prerequisite is actually holding this task up. */}
              <Icon icon={b.done ? Check : Circle} size={12}
                style={{ flexShrink: 0, color: b.done ? 'var(--green-text)' : 'var(--red)' }} />
              <span style={{
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: b.done ? 'var(--text-secondary)' : 'var(--ink-2)',
                textDecoration: b.done ? 'line-through' : 'none',
              }}>{b.title}</span>
              <button
                onClick={() => onRemove(b.id)}
                aria-label={`Stop waiting for ${b.title}`}
                style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, flexShrink: 0, border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <Icon icon={X} size={12} />
              </button>
            </div>
          ))}
        </>
      )}

      <div style={{ borderTop: blockers.length ? '1px solid var(--line-2)' : 'none', marginTop: blockers.length ? 6 : 0, paddingTop: blockers.length ? 6 : 0 }}>
        {/* A field inside a panel is the DS `MenuField` (the overlay-chrome directive): the wash as its ground, the house placeholder ink, the caret as its focus. */}
        <MenuField
          icon={<Icon icon={Search} size={16} />}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Wait for another task…"
          aria-label="Search tasks"
        />

        {term.trim() && (
          <div style={{ maxHeight: 168, overflowY: 'auto' }}>
            {hits.length === 0 ? (
              <div style={{ padding: '4px 8px 6px', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
                {searching ? 'Searching…' : 'No tasks match.'}
              </div>
            ) : hits.map((h) => {
              // The picker refuses for the SAME reasons the server does
              // (lib/task-links.ts), and says which — offering a choice that is
              // then rejected is worse than never offering it. Refused rows stay
              // visible rather than vanishing, so "why isn't it in the list?"
              // never comes up.
              const refusal = checkLink(links, taskId, h.id);
              return (
                <button
                  key={h.key}
                  className={POP_ROW_CLASS}
                  style={{ ...popRow, opacity: refusal ? 0.55 : 1, cursor: refusal ? 'default' : 'pointer' }}
                  disabled={!!refusal}
                  onClick={() => add(h)}
                  title={refusal ? REFUSAL_TEXT[refusal] : undefined}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                  {refusal && (
                    <span style={{ flexShrink: 0, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
                      {refusal === 'duplicate' ? 'already' : refusal === 'self' ? 'this task' : refusal === 'cycle' ? 'would loop' : 'limit'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
