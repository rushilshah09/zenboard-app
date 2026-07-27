'use client';
// Projects → Docs tab. Lists docs linked to the project, creates new ones (via
// the shared Library actions, with project_id set), and edits them in a drawer
// with the same autosave + content model as Library. A per-doc "Share with
// client" toggle drives the portal (client_visible). Open in Library deep-links.
//
// DS-built: §5.1 Button, §4.3 IconButton, §4.37 Drawer (savedStamp autosave),
// §4.45 EmptyState. No inline styles, no legacy Paper-OS tokens.
import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2, ExternalLink, Eye, EyeOff } from "@/components/ds/icons";
import Link from 'next/link';
import { Icon, Button, IconButton, Drawer, EmptyState } from '@/components/ds/ui';
import { addPage, updatePage, deletePage, getPage } from '@/lib/actions/library';
import { setDocClientVisible } from '@/lib/actions/portal';
import { BlockEditor } from '@/components/documents/block-editor';
import { type Block, toBlocks, serialize } from '@/lib/blocks';
import { cn } from '@/lib/cn';
import type { PDoc } from '@/components/projects/projects-workspace';

const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 604800) return Math.floor(d / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ProjectDocs({
  projectId, docs, portalSupported, onChange, flash,
}: {
  projectId: string;
  docs: PDoc[];
  portalSupported: boolean;
  onChange: (next: PDoc[]) => void;
  flash: (m: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);

  async function create() {
    const tmp = 'tmp-' + Date.now();
    const optimistic: PDoc = { id: tmp, project_id: projectId, title: 'Untitled', type: 'doc', client_visible: false, updated_at: new Date().toISOString() };
    onChange([optimistic, ...docs]);
    const res = await addPage({ projectId, type: 'doc' });
    if ('id' in res) { onChange([{ ...optimistic, id: res.id }, ...docs]); setEditId(res.id); }
    else { onChange(docs); flash('Could not create doc.'); }
  }

  async function remove(id: string) {
    onChange(docs.filter((d) => d.id !== id));
    if (!id.startsWith('tmp-')) { const r = await deletePage(id); if ('error' in r) flash(r.error); }
  }

  async function toggleShare(id: string) {
    const doc = docs.find((d) => d.id === id); if (!doc) return;
    const next = !doc.client_visible;
    onChange(docs.map((d) => (d.id === id ? { ...d, client_visible: next } : d)));
    const r = await setDocClientVisible(id, next);
    if ('error' in r) { onChange(docs.map((d) => (d.id === id ? { ...d, client_visible: !next } : d))); flash(r.error); }
  }

  function onSaved(id: string, title: string) {
    onChange(docs.map((d) => (d.id === id ? { ...d, title, updated_at: new Date().toISOString() } : d)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center">
        <span className="text-ui text-ink-500">{docs.length} doc{docs.length === 1 ? '' : 's'}</span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={14} />} onClick={create}>New doc</Button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong">
          <EmptyState
            size="inline"
            illustration={<Icon icon={FileText} size={20} />}
            title="No docs yet"
            description="Briefs, scopes, notes — add one and optionally share it in the portal."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-raised">
          {docs.map((d, i) => (
            <div key={d.id} className={cn('flex items-center gap-3 px-3.5 py-3', i > 0 && 'border-t border-line-soft')}>
              <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />
              <button onClick={() => setEditId(d.id)} className="focus-ring min-w-0 flex-1 rounded-xs text-left">
                <div className="truncate text-ui text-ink-900">{d.title?.trim() || 'Untitled'}</div>
                <div className="text-caption text-ink-500">Edited {ago(d.updated_at)}</div>
              </button>
              {portalSupported && (
                <button
                  onClick={() => toggleShare(d.id)}
                  aria-pressed={d.client_visible}
                  title={d.client_visible ? 'Shared with client — click to unshare' : 'Share with client'}
                  className={cn('focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm border border-line-strong px-2 text-caption font-medium transition-colors duration-fast',
                    d.client_visible ? 'bg-surface-selected text-ink-900' : 'text-ink-600 hover:bg-surface-hover hover:text-ink-800')}>
                  <Icon icon={d.client_visible ? Eye : EyeOff} size={12} />{d.client_visible ? 'Shared' : 'Private'}
                </button>
              )}
              <Link href={`/library?page=${d.id}`} title="Open in Library" aria-label="Open in Library"
                className="focus-ring grid size-7 shrink-0 place-items-center rounded-sm text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800">
                <Icon icon={ExternalLink} size={14} />
              </Link>
              <IconButton size="sm" variant="ghost" label="Delete" icon={<Icon icon={Trash2} size={14} />} onClick={() => remove(d.id)} className="shrink-0" />
            </div>
          ))}
        </div>
      )}

      {editId && <DocEditor id={editId} onClose={() => setEditId(null)} onSaved={onSaved} flash={flash} />}
    </div>
  );
}

function DocEditor({ id, onClose, onSaved, flash }: { id: string; onClose: () => void; onSaved: (id: string, title: string) => void; flash: (m: string) => void }) {
  const [title, setTitle] = useState('');
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
    if (state === 'loading' || id.startsWith('tmp-')) return;
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

  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }} modal size="lg" title="Doc"
      savedStamp={state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : undefined}>
      {state === 'loading' ? (
        <div className="py-12 text-center text-ui text-ink-500">Loading…</div>
      ) : (
        <div className="px-2 pb-16 pt-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="mb-4 w-full border-0 bg-transparent text-title-2 text-ink-900 outline-none placeholder:text-ink-400" />
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        </div>
      )}
    </Drawer>
  );
}
