'use client';
// An item of a Collection, opened (COLLECTION_PLAN K4 and K9; COLLECTION_VIEW_BRIEF §17–18, §38): its
// picture large, its name to change, the way to what it links to, what is known about it, and what you
// wrote about it. Opened through the ONE <PageView>, in the centre by default — you look at a reference,
// you do not work through it.
//
// The notes are what a Collection has that a bookmarking tool does not (§38): a collected thing is
// written about in the Zenboard editor, not just kept. A note item has no separate notes — its words
// ARE its body, so the editor sits under its name instead of under its details.
import { Fragment, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, Tag, Trash2 } from '@/components/ds/icons';
import { Button, DropdownMenuItem, Icon, PageView } from '@/components/ds/ui';
import { OptionList } from '@/components/ui/select';
import type { Block } from '@/lib/blocks';
import { ITEM_KIND_LABEL, itemBody, resolveTags, type CollectionItem, type CollectionTag } from '@/lib/collection';
import { palette } from '@/lib/palette';
import { collectionPicture, collectionSource } from '@/lib/collection-item';
import { formatDay, formatDayTime } from '@/lib/date';
import { hostOf } from '@/lib/unfurl';
import { useLatest } from '@/lib/use-latest';
import { noteTitle, openLabel, useItemFileUrl } from './collection-card';
import { Pop } from './db-pop';
import { OptionChip } from './option-chip';

// The editor is the heaviest thing in Documents; a Collection should not carry it until an item is opened.
const BlockEditorLazy = dynamic(() => import('./block-editor').then((m) => ({ default: m.BlockEditor })), { ssr: false });
/** Long enough that a sentence is one save, short enough that nothing typed is ever lost. */
const SETTLE = 400;

export function CollectionItemPage({ item, vocabulary, attachTo, onClose, onRename, onDelete, onToggleTag, onCreateTag, onBody }: {
  item: CollectionItem;
  /** The Collection's tags: what this item's tag ids name, and what it may be given. */
  vocabulary?: readonly CollectionTag[];
  onClose: () => void;
  /** Put a tag on the item, or take it off. */
  onToggleTag: (tagId: string) => void;
  /** Make a tag with this name (or find the one already called it) and put it on the item. */
  onCreateTag: (name: string) => void;
  /** The person's name for the item; empty gives it back its link's or file's name. */
  onRename: (title: string) => void;
  onDelete: () => void;
  /** What was written about the item — settled, not per keystroke. */
  onBody: (blocks: Block[]) => void;
  /** What a file dropped into the notes hangs off: the Collection's page, when it has one. */
  attachTo?: { page_id: string };
}) {
  const [draft, setDraft] = useState(item.title ?? '');
  // Read once: `itemBody` mints ids, and a new id every render would remount the editor under the caret.
  const [blocks, setBlocks] = useState<Block[]>(() => itemBody(item));
  const [tagging, setTagging] = useState(false);
  const tags = resolveTags(vocabulary, item.tags);
  const fileUrl = useItemFileUrl(item.file);
  const picture = item.kind === 'image' && fileUrl ? fileUrl : item.url ? collectionPicture(item.url, { image: item.image }) : null;
  const video = item.kind === 'video' && fileUrl ? fileUrl : null;
  const fallbackName = item.kind === 'note' ? noteTitle(item.note) : item.url ? hostOf(item.url) : item.file?.name ?? 'Untitled';
  const source = item.url ? collectionSource(item.url) : null;
  const commit = () => {
    if (draft.trim() !== (item.title ?? '')) onRename(draft);
  };

  // Writing settles before it is saved, so a long note is not a change per keystroke; whatever is still
  // waiting is written when the page closes.
  const waiting = useRef<Block[] | null>(null);
  const write = useLatest(onBody);
  const opened = useRef(false);
  useEffect(() => {
    // The first run is the page opening, not something written.
    if (!opened.current) { opened.current = true; return; }
    waiting.current = blocks;
    const t = setTimeout(() => {
      if (!waiting.current) return;
      write.current(waiting.current);
      waiting.current = null;
    }, SETTLE);
    return () => clearTimeout(t);
  }, [blocks, write]);
  useEffect(() => () => { if (waiting.current) write.current(waiting.current); }, [write]);

  const notes = <BlockEditorLazy blocks={blocks} onChange={setBlocks} attachTo={attachTo} />;
  const details: [string, string | undefined][] = [
    ['Kind', ITEM_KIND_LABEL[item.kind]],
    ['Source', source && source !== 'Website' ? source : item.url ? hostOf(item.url) : undefined],
    ['Author', item.author],
    ['Published', item.published ? formatDay(item.published) : undefined],
    ['File', item.file?.name],
    ['Added', formatDayTime(item.createdAt)],
  ];

  return (
    <PageView open contentType="collection-item" title={item.title || fallbackName}
      onOpenChange={(open) => { if (!open) { commit(); onClose(); } }}
      more={<DropdownMenuItem danger icon={<Icon icon={Trash2} size={14} />} onSelect={onDelete}>Delete item</DropdownMenuItem>}>
      <div className="flex flex-col gap-5 p-5">
        {video ? (
          <video src={video} controls playsInline className="max-h-[60vh] w-full rounded-lg border border-line-soft bg-surface-fill" />
        ) : picture ? (
          /* eslint-disable-next-line @next/next/no-img-element -- any site's image, a platform thumbnail or a signed upload; next/image needs a known host */
          <img src={picture} alt={item.title ?? ''} referrerPolicy="no-referrer"
            className="max-h-[60vh] w-full rounded-lg border border-line-soft bg-surface-fill object-contain" />
        ) : null}

        {/* Chromeless, like a page's title: the words are the field. */}
        <input value={draft} aria-label="Name" placeholder={fallbackName}
          autoComplete="off" data-1p-ignore data-lpignore="true" data-chromeless
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }}
          className="w-full border-0 bg-transparent p-0 font-semibold text-ink-900 outline-none placeholder:text-ink-500"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1-size)', letterSpacing: '-0.02em', lineHeight: 1.25 }} />

        {/* A note's words are the item: they sit where the item's own content belongs, under its name. */}
        {item.kind === 'note' && <div data-item-notes>{notes}</div>}

        {(item.url || fileUrl) && (
          <div className="flex flex-wrap gap-2">
            {item.url && (
              <Button size="sm" variant="secondary" icon={<Icon icon={ExternalLink} size={16} />}
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>{openLabel(item)}</Button>
            )}
            {fileUrl && (
              <Button size="sm" variant="secondary" icon={<Icon icon={ExternalLink} size={16} />}
                onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}>Open file</Button>
            )}
          </div>
        )}

        {/* Its tags (K7): the Collection's own words, picked or made here. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => <OptionChip key={t.id} opt={t} />)}
          <div className="relative">
            <Button size="xs" variant="ghost" icon={<Icon icon={Tag} size={16} />} aria-expanded={tagging} onClick={() => setTagging(true)}>
              {tags.length ? 'Edit tags' : 'Add tags'}
            </Button>
            {tagging && (
              <Pop onClose={() => setTagging(false)} width={260}>
                <OptionList multi placeholder="Search or create a tag…"
                  options={(vocabulary ?? []).map((t) => ({ value: t.id, label: t.name, dot: palette(t.color).dot }))}
                  selected={item.tags ?? []}
                  onPick={onToggleTag}
                  onCreate={onCreateTag} />
              </Pop>
            )}
          </div>
        </div>

        {item.description && <p className="text-body text-ink-800">{item.description}</p>}

        <dl className="grid grid-cols-[minmax(88px,auto)_1fr] gap-x-4 gap-y-2 text-meta">
          {details.filter(([, value]) => value).map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-ink-500">{label}</dt>
              <dd className="min-w-0 truncate text-ink-800">{value}</dd>
            </Fragment>
          ))}
        </dl>

        {/* What you thought about it (§38) — the thing a board of pictures cannot keep. */}
        {item.kind !== 'note' && (
          <div className="border-t border-line-soft pt-4">
            <p className="text-overline mb-1">Notes</p>
            <div data-item-notes>{notes}</div>
          </div>
        )}
      </div>
    </PageView>
  );
}
