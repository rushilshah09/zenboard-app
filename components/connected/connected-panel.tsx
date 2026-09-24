'use client';
// The Connected panel — master plan §3.4. One quiet section, identical on every
// drawer and detail view, showing an entity's edges grouped by what's on the other
// end. This is the thing that makes Zenboard read as one system instead of tabs:
// a task saying "Acme rebrand · Meridian Studio · billed on INV-014" answers three
// questions the task page could never answer alone.
//
// Deliberately NOT a card. It's a section inside whatever surface hosts it — a
// heading, hairline-ruled rows, no fill, no accent. Per the constitution the
// panel introduces zero filled-accent elements, so it can be dropped into any
// screen without spending that screen's one accent.
//
// It renders NOTHING when an entity has no edges. An empty "Connected" heading on
// a fresh task is noise: the panel should appear as the graph fills in, not sit
// there asking to be fed.
import { useEffect, useState } from 'react';
import { ShareNetwork, FileText, ChevronRight } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { createClient } from '@/lib/supabase/client';
import {
  loadConnected, mentionsSupported, edgeCount,
  type ConnectedGroup, type EntityRef, type EntityType, type ConnectedEdge,
} from '@/lib/connected';
import { ENTITY_GLYPH } from '@/components/connected/entity-icons';

// One glyph per concept, reused wherever that concept appears (icon seam rule #3).
// Project/Client/Task/Goal/Form match the shell's nav glyphs exactly so a row here
// reads as the same thing it is over there. Invoice and Document use the glyph for
// the RECORD (Receipt, FileText) rather than the section (Landmark, Scroll) — a
// Connected row points at one invoice, not at Finance.
// The one glyph map (components/connected/entity-icons.ts). `memory` is in it
// so the record is total, though a fact never renders as a Connected row.
const GLYPH = ENTITY_GLYPH;

// Past this many rows a group collapses. A Connected panel is a map of the
// neighbourhood, not a second task list — a client with 40 open tasks should read
// as "40 tasks", not scroll for a screen and a half.
const COLLAPSE_AFTER = 5;

function EdgeRow({ e }: { e: ConnectedEdge }) {
  const body = (
    <>
      <Icon
        icon={GLYPH[e.type] ?? FileText}
        size={14}
        className="shrink-0 text-ink-500"
      />
      {/* Content width, not flex-1 — so the label's meta sits right beside it
          ("New life · Active") instead of stranding at the far edge of a wide
          column. The spacer below still stretches the row so the chevron marks
          the whole thing as a link. The label keeps shrink+min-w-0, so it (not
          the via/meta) is what truncates when the row runs out of room. */}
      <span className={`min-w-0 truncate ${e.tombstone ? 'text-ink-500 line-through' : 'text-ink-800'}`}>
        {e.label}
      </span>
      {/* `via` is meaning, not decoration — it is the only thing explaining why
          Meridian Studio appears under a task at all. It stays on every width. */}
      {e.via && (
        <span className="shrink-0 text-caption text-ink-500">via {e.via}</span>
      )}
      {e.meta && (
        <span className="shrink-0 text-caption text-ink-500 tabular-nums">{e.meta}</span>
      )}
      {/* Pushes the chevron (not the status) to the right edge. */}
      <span aria-hidden className="flex-1" />
      {e.href && (
        <Icon icon={ChevronRight} size={12} className="shrink-0 text-ink-500 opacity-0 transition-opacity group-hover/edge:opacity-100" />
      )}
    </>
  );

  // 32px — the DS row rung for a compact reference row (nav/menu items), not the
  // 36px task rung: these are pointers to work, not the work itself.
  const shared = 'group/edge flex min-h-8 items-center gap-2 text-ui';

  return (
    <li>
      {e.href ? (
        <a href={e.href} className={`focus-ring -mx-1.5 rounded-md px-1.5 hover:bg-surface-hover ${shared}`}>
          {body}
        </a>
      ) : (
        // No addressable route for this type yet (see hrefFor in lib/connected.ts).
        // The row still earns its place — knowing the edge exists is the point —
        // it just isn't dressed up as a link it can't honour.
        <div className={shared}>{body}</div>
      )}
      {e.context && (
        <p className="pb-1 pl-6 font-editorial text-caption italic text-ink-500">
          &ldquo;{e.context}&rdquo;
        </p>
      )}
    </li>
  );
}

function Group({ group }: { group: ConnectedGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = group.items.length - COLLAPSE_AFTER;
  const shown = expanded ? group.items : group.items.slice(0, COLLAPSE_AFTER);

  return (
    <div className="border-t border-line-soft pt-2 first:border-0 first:pt-0">
      <h4 className="pb-0.5 text-overline text-ink-500">{group.label}</h4>
      <ul>
        {shown.map((e) => <EdgeRow key={e.key} e={e} />)}
      </ul>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="focus-ring -mx-1.5 rounded-md px-1.5 py-1 text-caption text-ink-500 hover:text-ink-800"
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

export interface ConnectedPanelProps {
  self: EntityRef;
  /** Pre-loaded groups — skips the fetch entirely (server-rendered surfaces, harnesses, tests). */
  groups?: ConnectedGroup[];
  /** Entity types the host surface already renders itself — dropped rather than repeated. */
  omit?: EntityType[];
  /** Bump to refetch — for hosts that can create edges (e.g. linking a doc to a project). */
  refreshKey?: number;
  className?: string;
}

export function ConnectedPanel({ self, groups: provided, omit, refreshKey, className }: ConnectedPanelProps) {
  const [fetched, setFetched] = useState<ConnectedGroup[] | null>(null);
  // Pre-loaded groups are read straight through rather than mirrored into state:
  // copying a prop into state in an effect costs an extra render and desyncs the
  // first paint for no benefit.
  const groups = provided ?? fetched;

  useEffect(() => {
    if (provided) return;
    let cancelled = false;
    (async () => {
      const db = createClient();
      // Probe and load in one pass — mentions (0027) may not exist yet, and the
      // structural half of the graph must not wait on finding that out.
      const mentions = await mentionsSupported(db);
      const next = await loadConnected(db, self, { mentions, omit });
      if (!cancelled) setFetched(next);
    })();
    return () => { cancelled = true; };
    // `omit` is a literal array at every call site; keying on its contents rather
    // than its identity avoids refetching the whole graph on each render.
  }, [self.type, self.id, provided, omit?.join(','), refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing yet, or nothing at all — render nothing. No skeleton: the panel sits
  // below content that's already useful, and a flashing placeholder there reads
  // as breakage rather than loading.
  if (!groups || groups.length === 0) return null;

  return (
    <section className={className} aria-label="Connected">
      <div className="flex items-center gap-2 pb-1.5">
        <Icon icon={ShareNetwork} size={14} className="text-ink-500" />
        <h3 className="text-meta font-semibold text-ink-800">Connected</h3>
        <span className="text-caption text-ink-500 tabular-nums">{edgeCount(groups)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map((g) => <Group key={g.type} group={g} />)}
      </div>
    </section>
  );
}
