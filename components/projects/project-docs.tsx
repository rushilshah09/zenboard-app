'use client';
// Projects → Docs tab. Lists docs linked to the project, creates new ones (via
// the shared Library actions, with project_id set), and edits them in a drawer
// with the same autosave + content model as Library. A per-doc "Share with
// client" toggle drives the portal (client_visible). "Open in Documents" deep-links.
//
// DS-built: §5.1 Button, §4.3 IconButton, §2.11 PageView (the one detail shell —
// a doc opens the same way here as in Documents), §4.45 EmptyState. No inline
// styles, no legacy Paper-OS tokens.
import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2, ExternalLink, Video } from "@/components/ds/icons";
import Link from 'next/link';
import { Icon, Button, IconButton, PageView, EmptyState, cardClass } from '@/components/ds/ui';
import { SkeletonText } from '@/components/ds/ui/skeleton';
import { addPage, updatePage, deletePage, getPage } from '@/lib/actions/library';
import { isDocumentPage } from '@/lib/page-kinds';
import { setDocClientVisible } from '@/lib/actions/portal';
import { ShareToggle } from '@/components/sharing/share-toggle';
import { applyShare } from '@/components/sharing/apply-share';
import type { ShareChannels } from '@/lib/visibility';
import dynamic from 'next/dynamic';
import { type Block, toBlocks, serialize } from '@/lib/blocks';
import { cn } from '@/lib/cn';
import type { PDoc } from '@/components/projects/projects-workspace';
import { formatAgo } from '@/lib/date';
import { isTempId, tempId } from '@/lib/temp-id';

// A ProseMirror editor CANNOT render on the server — it needs a real DOM to
// build its view — so every byte of it in the worker bundle was work thrown
// away on first paint. It also only ever appears inside a panel that opens on
// interaction, never in the initial HTML.
//
// `ssr: false` is therefore the correct shape, not only the smaller one, and
// `database-view.tsx` already loads it this way. Static imports here put the
// whole editor in the Cloudflare worker, which has a 3 MiB gzipped ceiling.
const BlockEditor = dynamic(
  () => import('@/components/documents/block-editor').then((m) => ({ default: m.BlockEditor })),
  { ssr: false },
);

const ago = (iso: string) => formatAgo(iso, { precise: true }) ?? '';

// The reading column. Full page is full-bleed, so a doc needs its own measure
// (the fixed-width drawer used to give this for free). Narrower than 720 in a
// side peek, it simply fills. Shared by the skeleton so the two cannot drift.
const DOC_MEASURE = 'mx-auto w-full max-w-[720px] px-6 pb-16 pt-6';

export function ProjectDocs({
  projectId, projectName, docs, portalSupported, channels, onChange, flash,
}: {
  projectId: string;
  /** For the document trail — a doc opened from here says where it lives. */
  projectName: string;
  docs: PDoc[];
  portalSupported: boolean;
  /** The project's share switches — the first of the two visibility gates. */
  channels: ShareChannels;
  onChange: (next: PDoc[]) => void;
  flash: (m: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);

  // ── A CONTENT PIECE IS NOT A DOC ────────────────────────────────────────
  //
  // The loader fetches every `pages` row carrying this `project_id`, and a
  // content piece carries one — the close-out creates them that way on purpose,
  // so a case study knows which job it came from. This list rendered all of
  // them: measured on the harness, **"4 docs" for three docs and a case
  // study**, and clicking it would have handed a content piece to the DOCUMENT
  // editor, where it has no stage, dates, brief or client sign-off.
  //
  // `isDocumentPage` is THE rule for which module owns a `pages` row, and its
  // own note says the next module to store a page adds a line THERE rather
  // than rediscovering this in another query file. Documents already uses it;
  // this was the fourth place to need it and the first to nearly re-hand-roll
  // it as `type !== 'content'` — which would have gone stale the moment a
  // fifth type appeared.
  //
  // Split here rather than in the loader, because the project SHOULD show what
  // it produced — just not as writing. Filtering upstream would have fixed the
  // count by hiding the work.
  const written = docs.filter((d) => isDocumentPage(d.type));
  const madeContent = docs.filter((d) => !isDocumentPage(d.type));

  async function create() {
    const tmp = tempId();
    const optimistic: PDoc = { id: tmp, project_id: projectId, title: 'Untitled', type: 'doc', client_visible: false, updated_at: new Date().toISOString() };
    onChange([optimistic, ...docs]);
    const res = await addPage({ projectId, type: 'doc' });
    if ('id' in res) { onChange([{ ...optimistic, id: res.id }, ...docs]); setEditId(res.id); }
    else { onChange(docs); flash('Could not create doc.'); }
  }

  async function remove(id: string) {
    onChange(docs.filter((d) => d.id !== id));
    if (!isTempId(id)) { const r = await deletePage(id); if ('error' in r) flash(r.error); }
  }

  async function toggleShare(id: string) {
    const doc = docs.find((d) => d.id === id); if (!doc) return;
    const next = !doc.client_visible;
    const set = (v: boolean) => onChange(docs.map((d) => (d.id === id ? { ...d, client_visible: v } : d)));
    set(next);
    await applyShare(() => setDocClientVisible(id, next), () => set(!next), flash);
  }

  function onSaved(id: string, title: string) {
    onChange(docs.map((d) => (d.id === id ? { ...d, title, updated_at: new Date().toISOString() } : d)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center">
        <span className="text-ui text-ink-500">{written.length} doc{written.length === 1 ? '' : 's'}</span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={14} />} onClick={create}>New doc</Button>
      </div>

      {written.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong">
          <EmptyState
            size="inline"
            illustration={<Icon icon={FileText} size={20} />}
            title="No docs yet"
            description="Briefs, scopes, notes — add one and optionally share it in the portal."
          />
        </div>
      ) : (
        <div className={cardClass('overflow-hidden @container')}>
          {/* A query container, like the task list's card: on a phone the
              share pill drops its word — it had left each doc title ~14
              characters. */}
          {written.map((d, i) => (
            <div key={d.id} className={cn('group flex items-center gap-3 px-3.5 py-3', i > 0 && 'border-t border-line-soft')}>
              <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />
              <button onClick={() => setEditId(d.id)} className="focus-ring min-w-0 flex-1 rounded-xs text-left">
                <div className="truncate text-ui text-ink-900">{d.title?.trim() || 'Untitled'}</div>
                <div className="text-caption text-ink-500">Edited {ago(d.updated_at)}</div>
              </button>
              {portalSupported && (
                <ShareToggle
                  kind="doc"
                  item={{ client_visible: d.client_visible }}
                  channels={channels}
                  name={d.title?.trim() || 'Untitled'}
                  onToggle={() => toggleShare(d.id)}
                />
              )}
              {/* Was `/library?page=` — a redirect that dropped the query string,
                  so this landed on the Documents hub instead of the doc. Also
                  "Library" is not a name the glossary uses any more. */}
              <Link href={`/documents?page=${d.id}`} title="Open in Documents" aria-label="Open in Documents"
                className="focus-ring grid size-7 shrink-0 place-items-center rounded-sm text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800">
                <Icon icon={ExternalLink} size={14} />
              </Link>
              <IconButton size="sm" variant="ghost" label="Delete" icon={<Icon icon={Trash2} size={14} />} onClick={() => remove(d.id)} className="shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* ── WHAT THIS PROJECT BECAME ─────────────────────────────────────
          Content made about this job. The close-out offers exactly this at the
          moment the work finishes ("finished work is the best marketing a
          studio ever has"), and until now the pieces it created were only
          findable in Content — the project that produced them said nothing.

          A LINK, not an editor: a piece is worked on in Content, where its
          stage, dates, brief and client sign-off live. Opening it in a document
          editor here is the very confusion this section exists to end. */}
      {madeContent.length > 0 && (
        <section className="mt-7">
          <h3 className="mb-2 text-overline">Content from this project</h3>
          <div className={cardClass('overflow-hidden')}>
            {madeContent.map((d, i) => (
              <Link
                key={d.id}
                href={`/content?piece=${d.id}`}
                className={cn(
                  'focus-ring group flex items-center gap-3 px-3.5 py-3 transition-colors duration-fast hover:bg-surface-hover',
                  i > 0 && 'border-t border-line-soft',
                )}
              >
                <Icon icon={Video} size={16} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui text-ink-900">{d.title?.trim() || 'Untitled'}</span>
                  <span className="block text-caption text-ink-500">Edited {ago(d.updated_at)}</span>
                </span>
                <Icon icon={ExternalLink} size={14} className="shrink-0 text-ink-500" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {editId && <DocEditor id={editId} projectName={projectName} initialTitle={docs.find((d) => d.id === editId)?.title ?? ''} onClose={() => setEditId(null)} onSaved={onSaved} flash={flash} />}
    </div>
  );
}

function DocEditor({ id, projectName, initialTitle, onClose, onSaved, flash }: { id: string; projectName: string; initialTitle: string; onClose: () => void; onSaved: (id: string, title: string) => void; flash: (m: string) => void }) {
  // Seeded from the row you clicked. The document's BODY has to be fetched,
  // but its title is already on screen in the list behind this panel — opening
  // it into a skeleton and then replacing it with the same words is the app
  // forgetting what it just showed you. Only the body waits.
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved'>('loading');
  const skip = useRef(true);

  useEffect(() => {
    let alive = true;
    getPage(id).then((r) => { if (!alive) return; if ('error' in r) { flash(r.error); onClose(); return; } setTitle(r.title ?? ''); setBlocks(toBlocks(r.content)); skip.current = true; setState('idle'); });
    return () => { alive = false; };
  }, [id, onClose, flash]);

  // debounced autosave
  useEffect(() => {
    if (state === 'loading' || isTempId(id)) return;
    if (skip.current) { skip.current = false; return; }
    setState('saving');
    const t = setTimeout(async () => {
      const nextTitle = title.trim() || 'Untitled';
      const r = await updatePage(id, { title: nextTitle, content: serialize(blocks) });
      if ('error' in r) { flash(r.error); setState('idle'); return; }
      onSaved(id, nextTitle);
      setState('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [title, blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  const heading = title.trim() || 'Untitled';
  // A brand-new doc opens with an empty title and an empty body, and the block
  // editor's placeholder only renders on the FOCUSED block — so with the caret
  // nowhere, "New doc" landed you on a blank screen with no hint that anything
  // was typeable. Notion, Linear and Docs all put the caret in the title of a
  // page you just created; you named it in your head before you clicked.
  //
  // Only when it IS new: focusing the title of a doc you opened to read would
  // hijack a scroll position and risk an accidental rename.
  const titleRef = useRef<HTMLInputElement>(null);
  const fresh = state !== 'loading' && !title.trim() && blocks.every((b) => !b.text?.trim());
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (!fresh || focusedOnce.current) return;
    focusedOnce.current = true;
    titleRef.current?.focus();
  }, [fresh]);

  return (
    <PageView
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      contentType="document"
      // Header name tracks the editable H1 below; both stay in sync as you type.
      title={heading}
      // ── THE TRAIL ────────────────────────────────────────────────────────
      // A project doc opens FULL PAGE, which is right — it is the thing you
      // came to write. But full page replaces the workspace, so without a trail
      // the only evidence of where you are is a close button, and a new doc
      // (empty title, empty body) reads as a blank screen you cannot place.
      //
      // `doc-breadcrumbs.tsx` said this was coming: "keeping the three apart is
      // what lets Projects or Clients grow a trail later without copying any of
      // this." This is that trail — DS `Breadcrumbs` through PageView, no copy
      // of the Documents wiring, because a project doc's parent is a PROJECT
      // and not a folder in the documents tree.
      //
      // The project crumb CLOSES rather than navigates: the project is the page
      // directly underneath this one, so closing is both instant and literally
      // what "go up one" means here. "Projects" is a real link because that is
      // a different page.
      breadcrumbs={[
        { label: 'Projects', href: '/projects' },
        { label: projectName, onNavigate: onClose },
        { label: heading, icon: <Icon icon={FileText} size={14} /> },
      ]}
      // The doc's canonical address — makes "Open in new tab" a real link, not a
      // simulation. A not-yet-saved optimistic doc has no address yet.
      href={isTempId(id) ? undefined : `/documents?page=${id}`}
      // The quiet autosave stamp lives in the toolbar (§2.3), where <Drawer>'s
      // savedStamp footer used to put it.
      actions={
        state === 'saving' || state === 'saved'
          ? <span role="status" className="px-1 text-meta text-ink-500">{state === 'saving' ? 'Saving…' : 'Saved'}</span>
          : undefined
      }
    >
      {state === 'loading' ? (
        // A skeleton in the shape of the body, not a centred "Loading…": what
        // is coming is paragraphs, so the wait shows paragraphs and the content
        // lands without the layout jumping. The title is already real above it.
        <div className={DOC_MEASURE} aria-busy="true">
          <div className="mb-4 text-title-2 text-ink-900">{heading}</div>
          <div className="flex flex-col gap-3" aria-label="Loading document">
            <SkeletonText lines={3} />
          </div>
        </div>
      ) : (
        <div className={DOC_MEASURE}>
          {/* Enter from the title moves INTO the document rather than doing
              nothing — the title is a one-line field, so the key has no other
              meaning here and every editor binds it this way. */}
          <input data-chromeless ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget.closest('[data-doc-body]')?.querySelector('[contenteditable]') as HTMLElement | null)?.focus(); } }}
            placeholder="Untitled" aria-label="Document title" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="mb-4 w-full border-0 bg-transparent text-title-2 text-ink-900 outline-none placeholder:text-ink-500" />
          <div data-doc-body>
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </div>
        </div>
      )}
    </PageView>
  );
}
