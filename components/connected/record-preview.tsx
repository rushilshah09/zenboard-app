'use client';
// What is on the other end of a mention, without going there.
//
// THE OTHER HALF OF A WORKING MENTION. A plain click now follows an internal
// link (`lib/use-follow-link.ts`, 2026-08-06); this is the half that lets you
// decide whether you want to. It was deliberately built SECOND: a preview card
// layered over a link that did not navigate would have been a fetch and a hover
// delay in front of a broken affordance.
//
// BENCHMARK (rule 7). Notion previews a page mention by rendering the page's
// CONTENT — which works because a Notion mention almost always points at a
// page. Ours addresses ELEVEN types and most of them have no body at all: an
// invoice, a client, a task, a project, a form, a goal. So the card answers a
// different question, and deliberately: **what kind of thing is this, and what
// state is it in.** Hovering "Acme rebrand" says Project · Active; hovering
// "INV-014" says Invoice · Overdue. That is the thing you would otherwise have
// navigated away to find out, which is the only justification for a preview.
//
// Linear's equivalent (hovering an issue id) does exactly this — identity and
// status, not content — and it is the right call for the same reason.
import { useEffect, useState } from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent, Icon } from '@/components/ds/ui';
import { FileText } from '@/components/ds/icons';
import { createClient } from '@/lib/supabase/client';
import { createStore, sharedFetch, peek } from '@/lib/shared-cache';
import { parseRecordHref, resolveSummaries, type EntityType, type RecordSummary } from '@/lib/connected';
import { ENTITY_GLYPH, ENTITY_LABEL } from '@/components/connected/entity-icons';

// The same glyph per concept as the Connected panel and the command palette. A
// record has one face in this product (icon seam rule #3).
// Both maps now live in components/connected/entity-icons.ts — this file and
// connected-panel carried identical private copies.
const GLYPH = ENTITY_GLYPH;
const TYPE_LABEL = ENTITY_LABEL;

const STORE = createStore<RecordSummary>();

/**
 * One record's summary, fetched at most once per session per record.
 *
 * `enabled` is what keeps this honest: the query fires when the card OPENS, not
 * when the link renders. A paragraph with eight mentions costs nothing until you
 * hover one — which is the difference between a preview and a page that
 * pre-fetches its own footnotes.
 */
function useRecordSummary(ref: { type: EntityType; id: string } | null, enabled: boolean) {
  const key = ref ? `${ref.type}:${ref.id}` : '';
  const [, bump] = useState(0);

  useEffect(() => {
    if (!ref || !enabled || peek(STORE, key) !== undefined) return;
    let alive = true;
    void sharedFetch(STORE, key, async () => {
      const found = await resolveSummaries(createClient(), [ref]);
      // Absent from the map is a real answer: the record is gone. `sharedFetch`
      // caches that null, so a deleted target is not re-queried on every hover.
      return found.get(key) ?? null;
    }).then(() => { if (alive) bump((n) => n + 1); });
    return () => { alive = false; };
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return ref ? peek(STORE, key) : undefined;
}

// `target`, and never `ref`: React treats a prop called `ref` specially, so this
// read as a real ref during render — which lint caught and which would have
// broken the moment anything forwarded one.
function Body({ target, open }: { target: { type: EntityType; id: string }; open: boolean }) {
  const summary = useRecordSummary(target, open);
  const glyph = GLYPH[target.type] ?? FileText;

  // Loading. Deliberately the SHAPE of the answer rather than a spinner: the
  // card is already open at a fixed width, so a spinner would be motion in a
  // box that is about to hold two lines of text.
  if (summary === undefined) {
    return (
      <div className="flex items-start gap-2">
        <Icon icon={glyph} size={14} className="mt-0.5 shrink-0 text-ink-500" />
        <div className="min-w-0 flex-1">
          <div className="h-3.5 w-2/3 rounded-sm bg-surface-hover" />
          <p className="pt-1.5 text-caption text-ink-500">{TYPE_LABEL[target.type]}</p>
        </div>
      </div>
    );
  }

  // Gone. The mention stays readable and says so — the same rule the Connected
  // panel uses for a tombstone, because a reference that silently means nothing
  // is worse than one that admits it.
  if (summary === null) {
    return (
      <div className="flex items-start gap-2">
        <Icon icon={glyph} size={14} className="mt-0.5 shrink-0 text-ink-500" />
        <div className="min-w-0 flex-1">
          <p className="text-ui text-ink-500 line-through">Deleted</p>
          <p className="pt-0.5 text-caption text-ink-500">
            This {TYPE_LABEL[target.type].toLowerCase()} no longer exists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Icon icon={glyph} size={14} className="mt-0.5 shrink-0 text-ink-500" />
      <div className="min-w-0 flex-1">
        {/* Wraps to two lines and then clamps. A preview that stretched to six
            lines would be the thing it is previewing. */}
        <p className="line-clamp-2 text-ui text-ink-800">{summary.label}</p>
        <p className="pt-0.5 text-caption text-ink-500">
          {TYPE_LABEL[summary.type]}
          {summary.meta ? ` · ${summary.meta}` : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * Wrap a link so hovering it previews the record it points at.
 *
 * Renders its children UNCHANGED when the href is not an internal record — an
 * external link gets no card, and neither does an internal route with no
 * record-level address. No wrapper component, no listener, no cost.
 */
export function RecordPreview({ href, children }: { href: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const recordRef = parseRecordHref(href);
  if (!recordRef) return <>{children}</>;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={420} closeDelay={120}>
      {/* `asChild` so the anchor stays the anchor — wrapping it in a span would
          break the inline flow of a mention sitting mid-sentence. */}
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent>
        <Body target={recordRef} open={open} />
      </HoverCardContent>
    </HoverCard>
  );
}
