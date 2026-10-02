'use client';
// One item of a Collection — its picture first, then its name, then where it came from
// (COLLECTION_PLAN K4; COLLECTION_VIEW_BRIEF §13–15). Never a wall of details.
//
// The picture is a platform's own thumbnail, an address that is itself an image, the picture the
// link offered, or an uploaded image or video — else a tile naming what the item is and where it
// lives, so no card ever looks broken (§7–8). A link collected a moment ago reads "Fetching
// preview…" until it answers, and "Preview unavailable" if it says nothing; the item is usable
// either way (§35–36). A note is simply its words.
//
// The card is the same in both of a Collection's presentations. How it is used — opened by a click
// in the grid, selected and moved on the canvas — is handed in as `gestures`.
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import {
  AlignLeft, ArrowLeft, ArrowRight, ExternalLink, File as FileGlyph, FileText, Globe, Image as ImageGlyph, Link as LinkIcon, Maximize2,
  MoreHorizontal, Music, Pencil, Play, Tag, Trash2,
  type IconType,
} from '@/components/ds/icons';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Icon, IconButton, LinkMark,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { palette } from '@/lib/palette';
import { ITEM_KIND_LABEL, type CollectionItem, type CollectionItemKind, type CollectionTag, type PreviewFit } from '@/lib/collection';
import { collectionPicture, collectionSource, collectionTileShape, readPreviewShape } from '@/lib/collection-item';
import { isMissingThumbnail, platformOf } from '@/lib/platforms';
import { hostOf, type LinkMeta } from '@/lib/unfurl';
import { useAttachmentUrl } from '@/lib/use-attachment';
import { useLinkMeta } from '@/lib/use-link-meta';
import { OptionChip } from './option-chip';

/** The most tags a card draws; the rest are counted (§14: "do not overload the card"). */
const CARD_TAGS = 3;
/** The one shape every card takes when the Collection is not a masonry — 4:3, the editorial default. */
const UNIFORM = 0.75;

export const KIND_GLYPH: Record<CollectionItemKind, IconType> = {
  link: Globe, image: ImageGlyph, video: Play, audio: Music, pdf: FileText, file: FileGlyph, note: FileText,
};
/** A tile is shaped like what it stands for: a video wide, a PDF tall like a page. Also a card's guess at its
 *  picture's shape until the picture says — so the grid can guess a card's height the way the card will. */
export const tileShape = (kind: CollectionItemKind) => collectionTileShape(ITEM_KIND_LABEL[kind]);

/** A note's first line — its name wherever one is needed. */
export const noteTitle = (note: string | undefined) => (note ?? '').split('\n')[0].trim().slice(0, 80) || 'Note';

/** What following an item's link does, in its own words. */
export function openLabel(item: CollectionItem): string {
  if (item.kind === 'pdf') return 'Open PDF';
  if (item.kind === 'image') return 'Open image';
  const source = item.url ? collectionSource(item.url) : null;
  if (item.kind === 'video' && source && source !== 'Website') return `Watch on ${source}`;
  return source && source !== 'Website' ? `Open in ${source}` : 'Open website';
}

/** An uploaded file's address: signed on demand for an attachment, or the harness's own. */
export function useItemFileUrl(file: CollectionItem['file']): string | null {
  const local = file?.attachmentId.startsWith('demo:') ? file.attachmentId.slice(5) : null;
  const { url } = useAttachmentUrl(file && !local ? file.attachmentId : null);
  return local ?? url ?? null;
}

export function CollectionCard({ item, tags, selected, gestures, menu, select, renaming, fit = 'original', titles = true, onRename, onRenamed, onLearn, onShape }: {
  item: CollectionItem;
  /** The tags the item carries, resolved from its Collection. */
  tags?: readonly CollectionTag[];
  selected?: boolean;
  /** How the card is used: the grid opens it on a click; the canvas selects it and moves it. */
  gestures: HTMLAttributes<HTMLDivElement>;
  /** The item's actions, revealed on hover. */
  menu?: ReactNode;
  /** The box that picks the item without a modifier (§16). The canvas has its own selection and passes none. */
  select?: ReactNode;
  /** How its picture is shown, and whether its name is shown at all (§28). The canvas takes neither. */
  fit?: PreviewFit;
  titles?: boolean;
  /** Its name is being changed here, from the card's own menu. */
  renaming?: boolean;
  onRename?: (title: string) => void;
  onRenamed?: () => void;
  /** What a link said when it answered — learned by the Collection, never an undo step. */
  onLearn: (id: string, url: string, meta: LinkMeta | null) => void;
  /** The shape the item's picture turned out to be. */
  onShape: (id: string, shape: number) => void;
}) {
  const url = item.url;
  // A link is asked what it is only while nothing is known about it yet.
  const ask = !!url && !item.title && !item.image && !item.siteName;
  const meta = useLinkMeta(ask ? url : undefined);
  useEffect(() => {
    if (ask && url && meta !== undefined) onLearn(item.id, url, meta);
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileUrl = useItemFileUrl(item.file);
  const [failed, setFailed] = useState<string | null>(null);
  const [shape, setShape] = useState<{ src: string; ratio: number } | null>(null);
  const picture = item.kind === 'image' && fileUrl ? fileUrl : url ? collectionPicture(url, { image: item.image ?? meta?.image }) : null;
  const video = item.kind === 'video' && fileUrl ? fileUrl : null;
  const fetching = ask && meta === undefined;
  const named = item.title || meta?.title;
  const unavailable = !named && ask && meta !== undefined && !meta?.image;
  const title = item.kind === 'note'
    ? noteTitle(item.note)
    : named || (url ? (fetching ? 'Fetching preview…' : 'Untitled resource') : item.file?.name || 'Untitled');
  const src = video ?? picture;
  const own = shape && shape.src === src ? shape.ratio : item.shape ?? tileShape(item.kind);
  // One shape for every card, unless the Collection asked for each picture's own — which is the masonry (§13).
  const ratio = fit === 'original' ? own : UNIFORM;
  const learnShape = (width: number, height: number, from: string) => {
    const read = width > 0 ? readPreviewShape(height / width) : undefined;
    if (!read) return;
    setShape({ src: from, ratio: read });
    onShape(item.id, read);
  };
  const domain = url ? hostOf(url) : null;
  const noted = !!item.body?.length;
  const source = url ? collectionSource(url) : null;

  return (
    <div className="group relative" data-collection-item={item.id}>
      <div tabIndex={0} {...gestures} aria-label={title} aria-busy={fetching || undefined}
        className={cn(
          'focus-ring flex w-full flex-col overflow-hidden rounded-lg border bg-surface-raised text-left transition-colors duration-fast hover:wash-over',
          selected ? 'border-accent ring-2 ring-accent' : 'border-line-soft',
          gestures.className,
        )}>
        {item.kind === 'note' ? (
          // A note has no picture to shape it, so a Collection asking for one shape has to give it one.
          <div className={cn('flex w-full flex-col', fit !== 'original' && 'overflow-hidden')}
            style={fit === 'original' ? undefined : { aspectRatio: `1 / ${UNIFORM}` }}>
            <p className="line-clamp-[12] whitespace-pre-wrap px-3 py-3 text-ui text-ink-800 [overflow-wrap:anywhere]">{item.note}</p>
            {tags && tags.length > 0 && <CardTags tags={tags} className="px-3 pb-3" />}
          </div>
        ) : video && failed !== video ? (
          <video data-card-picture src={video} muted playsInline preload="metadata"
            onLoadedMetadata={(e) => learnShape(e.currentTarget.videoWidth, e.currentTarget.videoHeight, video)}
            onError={() => setFailed(video)}
            className={cn('block w-full border-b border-line-soft bg-surface-fill', fit === 'contain' ? 'object-contain' : 'object-cover')}
            style={{ aspectRatio: `1 / ${ratio}` }} />
        ) : picture && failed !== picture ? (
          /* eslint-disable-next-line @next/next/no-img-element -- any site's image, a platform thumbnail or a signed upload; next/image needs a known host */
          <img data-card-picture src={picture} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              // YouTube answers a missing thumbnail with a grey image that LOADS.
              if (isMissingThumbnail(img)) { setFailed(picture); return; }
              learnShape(img.naturalWidth, img.naturalHeight, picture);
            }}
            onError={() => setFailed(picture)}
            className={cn('block w-full border-b border-line-soft bg-surface-fill', fit === 'contain' ? 'object-contain' : 'object-cover')}
            style={{ aspectRatio: `1 / ${ratio}` }} />
        ) : (
          <Tile kind={item.kind} ratio={ratio} label={unavailable ? 'Preview unavailable' : undefined} detail={domain ?? item.file?.name ?? null} />
        )}
        {/* Pictures only, when the Collection asked for that — except a note, which is nothing but its words. */}
        {item.kind !== 'note' && titles && (
          <div className="flex min-w-0 flex-col gap-1 px-2.5 pb-2.5 pt-2">
            {renaming ? (
              <CardName value={item.title ?? ''} placeholder={title} onCommit={(next) => { onRename?.(next); onRenamed?.(); }} onCancel={() => onRenamed?.()} />
            ) : (
              <span data-card-title className={cn('line-clamp-2 text-ui font-medium [overflow-wrap:anywhere]', named || item.file ? 'text-ink-900' : 'text-ink-500')}>{title}</span>
            )}
            <span className="flex min-w-0 items-center gap-1.5 text-meta text-ink-600">
              {url ? (
                <>
                  <LinkMark url={url} favicon={item.favicon ?? meta?.favicon} size={12} />
                  <span className="truncate">{source && source !== 'Website' ? source : domain}</span>
                </>
              ) : item.file ? (
                <span className="truncate">{ITEM_KIND_LABEL[item.kind]}</span>
              ) : null}
              {/* Written about (K9): the one thing a board of pictures cannot show, so the card says it. */}
              {noted && (
                <span role="img" aria-label="Has notes" title="Has notes" className="ml-auto flex shrink-0 items-center text-ink-500" data-item-noted>
                  <Icon icon={AlignLeft} size={12} />
                </span>
              )}
            </span>
            {tags && tags.length > 0 && <CardTags tags={tags} className="pt-0.5" />}
          </div>
        )}
      </div>
      {/* Hidden until wanted (§15), except on a card already picked — that one must say so. */}
      {select && <div className={cn('absolute left-1.5 top-1.5', !selected && 'reveal-on-hover')} data-no-drag>{select}</div>}
      {menu && <div className="reveal-on-hover absolute right-1.5 top-1.5" data-no-drag>{menu}</div>}
    </div>
  );
}

/** A card's name while it is being changed: the words are the field, as everywhere else in Zenboard. */
function CardName({ value, placeholder, onCommit, onCancel }: {
  value: string; placeholder: string; onCommit: (title: string) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  // The menu that opened this field is still closing, and its focus trap undoes an immediate focus (React's
  // own `autoFocus` included) — the caret ended up on nothing at all. Claimed after the next paint instead.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => { field.current?.focus(); field.current?.select(); });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, []);
  return (
    <input ref={field} value={draft} aria-label="Name" placeholder={placeholder}
      autoComplete="off" data-1p-ignore data-lpignore="true" data-chromeless
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (!cancelled.current) onCommit(draft); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); return; }
        if (e.key !== 'Escape') return;
        e.preventDefault();
        cancelled.current = true;
        onCancel();
      }}
      className="w-full rounded-[4px] border border-line-strong bg-surface-raised px-1 py-0.5 text-ui font-medium text-ink-900 outline-none focus-ring" />
  );
}

/** An item's tags on its card: the first few as chips, the rest counted. */
function CardTags({ tags, className }: { tags: readonly CollectionTag[]; className?: string }) {
  const hidden = tags.length - CARD_TAGS;
  return (
    <span data-card-tags className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      {tags.slice(0, CARD_TAGS).map((t) => <OptionChip key={t.id} opt={t} />)}
      {hidden > 0 && <span className="text-meta tabular-nums text-ink-500" title={tags.slice(CARD_TAGS).map((t) => t.name).join(', ')}>+{hidden}</span>}
    </span>
  );
}

/** A picture made of words, for an item with none (§8): what it is and where it lives. For a link
 *  that answered nothing, the words say its preview is unavailable (§35). */
function Tile({ kind, ratio, label, detail }: { kind: CollectionItemKind; ratio?: number; label?: string; detail: string | null }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-1 border-b border-line-soft bg-surface-fill px-3 text-center"
      style={{ aspectRatio: `1 / ${ratio ?? tileShape(kind)}` }}>
      <Icon icon={KIND_GLYPH[kind]} size={20} className="mb-0.5 text-ink-600" />
      <span className="text-meta font-medium text-ink-800">{label ?? ITEM_KIND_LABEL[kind]}</span>
      {detail && <span className="max-w-full truncate text-caption text-ink-600">{detail}</span>}
    </div>
  );
}

/** An item's actions: open it, follow what it links to, move it in the order, take it out of the Collection. */
export function ItemActions({ item, onOpen, onDelete, onMove, canMove, onRename, vocabulary, onToggleTag, onCopyLink }: {
  item: CollectionItem;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Change its name on the card itself. */
  onRename?: (id: string) => void;
  /** The Collection's own words, and putting them on this item from here. */
  vocabulary?: readonly CollectionTag[];
  onToggleTag?: (id: string, tagId: string) => void;
  /** Take its address away (§15). Only what has one. */
  onCopyLink?: (id: string) => void;
  /** One place earlier (-1) or later (+1) — the twin of ⌥← and ⌥→, and the only way on a touch screen. */
  onMove?: (delta: -1 | 1) => void;
  canMove?: { back: boolean; forward: boolean };
}) {
  // Rename opens a field on the CARD, and Radix hands focus back to this trigger as it closes — which took the
  // caret straight out of the field that had just opened. It asks the menu not to.
  const handsOn = useRef(false);
  const words = vocabulary ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton size="xs" variant="secondary" label="Item actions" icon={<Icon icon={MoreHorizontal} size={16} />} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52"
        onCloseAutoFocus={(e) => { if (handsOn.current) { e.preventDefault(); handsOn.current = false; } }}>
        <DropdownMenuItem icon={<Icon icon={Maximize2} size={16} />} onSelect={() => onOpen(item.id)}>Open</DropdownMenuItem>
        {item.url && (
          <DropdownMenuItem icon={<Icon icon={ExternalLink} size={16} />} onSelect={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>
            {openLabel(item)}
          </DropdownMenuItem>
        )}
        {(onRename || (onToggleTag && words.length > 0) || (onCopyLink && item.url)) && <DropdownMenuSeparator />}
        {onRename && (
          <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={() => { handsOn.current = true; onRename(item.id); }}>Rename</DropdownMenuItem>
        )}
        {/* A SUBMENU, not a popover: a popover opened from a menu is dismissed by the menu's own teardown
            (measured — it lived 25ms). Radix nests menus itself, and the roles and keys come with it. */}
        {onToggleTag && words.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={<Icon icon={Tag} size={16} />}>Tags</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {words.map((t) => (
                <DropdownMenuCheckboxItem key={t.id} checked={item.tags?.includes(t.id) ?? false}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => onToggleTag(item.id, t.id)}>
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: palette(t.color).dot }} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {onCopyLink && item.url && (
          <DropdownMenuItem icon={<Icon icon={LinkIcon} size={16} />} onSelect={() => onCopyLink(item.id)}>Copy link</DropdownMenuItem>
        )}
        {onMove && (canMove?.back || canMove?.forward) && (
          <>
            <DropdownMenuSeparator />
            {canMove?.back && (
              <DropdownMenuItem icon={<Icon icon={ArrowLeft} size={16} />} keys={['⌥', '←']} onSelect={() => onMove(-1)}>Move left</DropdownMenuItem>
            )}
            {canMove?.forward && (
              <DropdownMenuItem icon={<Icon icon={ArrowRight} size={16} />} keys={['⌥', '→']} onSelect={() => onMove(1)}>Move right</DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />} onSelect={() => onDelete(item.id)}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Whether an item's link is on a platform with its own name (YouTube, Instagram…). */
export const isPlatformLink = (item: CollectionItem) => !!item.url && !!platformOf(item.url);
