'use client';
// Dev-only harness for the @-mention picker panel. The picker normally fetches
// through the browser client, which returns nothing without a session — so this
// feeds <MentionMenu> pre-built hits and exercises every state it can be in:
// the bare-"@" recent list, a ranked query, the in-flight state, and no matches.
//
// The live trigger, caret anchoring and keyboard grammar are verified in the
// editor itself at /dev-preview/editor; this page is for the panel's own
// typography, density, glyphs and empty states. 404s in prod.
import { useState, useSyncExternalStore } from 'react';
import { notFound } from 'next/navigation';
import { RecordPreview } from '@/components/connected/record-preview';
import { MentionMenu } from '@/components/documents/mention-menu';
import { rankRecordHits, type RecordHit } from '@/lib/search';
import { recordHref, type EntityType } from '@/lib/connected';

// Hrefs come from `recordHref`, not hand-rolled — otherwise the harness can
// show a link shape the app does not actually produce.
const ID = '9f1c2b7e-4d3a-4c8b-9f10-2ab7c6de54';
const r = (type: EntityType, n: number, title: string, o: Partial<RecordHit> = {}): RecordHit => ({
  key: `${type}:${n}`,
  type,
  id: `${ID}${String(n).padStart(2, '0')}`,
  title,
  href: recordHref(type, `${ID}${String(n).padStart(2, '0')}`),
  ...o,
});

const ALL: RecordHit[] = [
  r('project', 1, 'Acme rebrand', { updatedAt: '2026-08-03T10:00:00Z' }),
  r('client', 2, 'Acme Industries', { updatedAt: '2026-08-02T10:00:00Z' }),
  r('doc', 3, 'Acme — kickoff notes', { updatedAt: '2026-08-01T10:00:00Z' }),
  r('task', 4, 'Send Acme the revised scope', { updatedAt: '2026-07-30T10:00:00Z' }),
  r('invoice', 5, 'INV-014', { meta: 'Overdue', updatedAt: '2026-07-29T10:00:00Z' }),
  r('form', 6, 'Acme intake', { meta: 'Draft', updatedAt: '2026-07-28T10:00:00Z' }),
  r('task', 7, 'Archive the old Acme brand files', { meta: 'Done', updatedAt: '2026-07-27T10:00:00Z' }),
  r('doc', 8, 'A title long enough to need truncating before it reaches the type label', { updatedAt: '2026-07-26T10:00:00Z' }),
];

const CASES: { label: string; query: string; hits: RecordHit[]; loading: boolean }[] = [
  { label: 'Bare “@” — recent', query: '', hits: rankRecordHits(ALL, '').slice(0, 6), loading: false },
  { label: 'Query — ranked', query: 'acme', hits: rankRecordHits(ALL, 'acme'), loading: false },
  { label: 'In flight, nothing yet', query: 'meri', hits: [], loading: true },
  { label: 'No matches', query: 'zzzz', hits: [], loading: false },
];

/**
 * Preview whatever `?ref=` points at.
 *
 * The hardcoded links above use invented ids, which exercise the TOMBSTONE
 * branch — genuinely useful, and the state hardest to get right. This exercises
 * the resolved one against a row that actually exists.
 *
 * Read in an effect rather than during render: the server has no `location`, and
 * reading it while rendering is a hydration mismatch.
 */
function RealRef() {
  // `useSyncExternalStore` rather than an effect: the server has no `location`,
  // reading it during render is a hydration mismatch, and setting state in an
  // effect just to say "now I know" is the cascading-render smell lint flags.
  // The subscribe callback is a no-op because the query string cannot change
  // without a navigation, which remounts this anyway.
  const href = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('ref'),
    () => null,
  );
  if (!href) return null;
  return (
    <p className="mt-4 text-body leading-7 text-ink-800">
      A real one:{' '}
      <RecordPreview href={href}>
        <a className="zb-rich-a" href={href}>{href}</a>
      </RecordPreview>
    </p>
  );
}

export default function MentionPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<string>('—');

  return (
    <div className="min-h-screen bg-paper p-8">
      <h1 className="mb-1 text-h3 text-ink-900">Mention picker</h1>
      <p className="mb-6 text-meta text-ink-600">
        Arrow keys are owned by the editor; this page exposes the active row as a
        control so every highlighted state can be inspected. Last pick: {picked}
      </p>
      <label className="mb-8 flex w-fit items-center gap-2 text-meta text-ink-700">
        Active row
        <input
          type="number" min={0} max={9} value={active}
          onChange={(e) => setActive(Number(e.target.value))}
          className="h-8 w-16 rounded-md border border-line-strong bg-surface-raised px-2 text-ui text-ink-900"
        />
      </label>
      <div className="flex flex-wrap items-start gap-10">
        {CASES.map((c) => (
          <div key={c.label} className="w-[288px]">
            <div className="mb-2 text-overline text-ink-500">{c.label}</div>
            <MentionMenu
              hits={c.hits}
              loading={c.loading}
              query={c.query}
              active={Math.min(active, Math.max(c.hits.length - 1, 0))}
              listId={`zb-mention-${c.query || 'recent'}`}
              pick={(h) => setPicked(`${h.title} → ${h.href}`)}
            />
          </div>
        ))}
      </div>

      {/* The other half of a mention: hovering one previews the record without
          navigating. The card asks "what kind of thing is this, and what state
          is it in" — not "what does it contain" — because five of the seven
          types a mention can address have no body at all. */}
      <section className="mt-14 max-w-[620px]">
        <h2 className="mb-1 text-overline text-ink-500">Hover preview</h2>
        <p className="mb-4 text-meta text-ink-600">
          Hover a link below. Internal links get a card after ~420ms; the external
          one is returned untouched and gets nothing at all.
        </p>
        {/* Raw <a>, deliberately, and NOT next/link: this section exists to
            exercise what `staticSpans` actually emits for a mention, which is a
            plain anchor carrying `zb-rich-a`. Swapping in <Link> would test
            something the editor never renders — hence the two disables below. */}
        <p className="text-body text-ink-800 leading-7">
          The rebrand is tracked in{' '}
          <RecordPreview href="/projects/11111111-2222-3333-4444-555555555555">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="zb-rich-a" href="/projects/11111111-2222-3333-4444-555555555555">Acme rebrand</a>
          </RecordPreview>
          , billed on{' '}
          <RecordPreview href="/money/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="zb-rich-a" href="/money/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">INV-014</a>
          </RecordPreview>
          , and written up in{' '}
          <RecordPreview href="/documents?page=99999999-8888-7777-6666-555555555555">
            <a className="zb-rich-a" href="/documents?page=99999999-8888-7777-6666-555555555555">the kickoff notes</a>
          </RecordPreview>
          . For contrast, an{' '}
          <RecordPreview href="https://example.com">
            <a className="zb-rich-a" href="https://example.com" rel="noreferrer">external link</a>
          </RecordPreview>
          {' '}renders with no wrapper.
        </p>

        {/* A REAL record, so the resolved branch can be checked and not just
            argued about. Pass any internal href: ?ref=/projects/<uuid> */}
        <RealRef />
      </section>
    </div>
  );
}
