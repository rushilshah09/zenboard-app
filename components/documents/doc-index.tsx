'use client';
// THE DOCUMENTS INDEX — redesigned 2026-09-30.
//
// User: "the current index page looks weird and feels amateur … rethink it." It was built
// "pixel-matched to the HiFi frames" (documents-view.tsx's header): a wall of 271×320 PORTRAIT
// cards, a dashed "New doc" card in the first cell, and a text dump for a preview. Measured on
// the page, the shape fought the content in both directions at once:
//   · titles truncated at ~16 characters ("Discussion call w…", "Packaging propo…") because a
//     portrait card is narrow — and a document is recognised by its TITLE;
//   · while ~70% of each card's height held nothing, or the words "Empty doc" in grey;
//   · fifteen identical "Updated 3h ago" stamps and no structure to say where today ended.
//
// What an index is FOR is finding a document again. So:
//   · LIST is the primary design: one panel per recency group (Today · Yesterday · Previous 7
//     days · …, lib/doc-recency.ts), 44px rows carrying the four things you find a doc by —
//     its title, its first line, where it lives, when you last touched it.
//   · GALLERY is the visual option, and it is drawn rather than printed: each tile is a
//     miniature of the page (components/ds/ui/drawn.tsx — the same language as the website's
//     illustrations and the slash menu's previews), landscape so the title gets the width.
//     An empty doc looks like a blank page, because it is one; nothing says "Empty doc".
//   · No create card. The header's New doc is the view's one brand action; a second create
//     affordance in the best cell of the grid was the same journey offered twice.
//
// Benchmarked (SPRINT_RULES 7): Linear's documents and project lists are flat 44px rows with
// metadata right-aligned and actions on hover — ours matches, and adds the first line and the
// recency headings Claude's and ChatGPT's histories use. Notion's gallery shows a page's
// content as text; ours deliberately DRAWS it, because a text dump at 12px is what read as
// amateur, and a drawing of the page's shape is recognisable at a glance and calm in quantity.
import { useMemo, useState, type ReactNode } from 'react';
import { Icon, TextInput, Popover, PopoverTrigger, PopoverContent } from '@/components/ds/ui';
import { cardClass, cardInteractiveClass } from '@/components/ds/ui/card';
import { Star, Tag, Check, Image as ImageIcon, Play, Paperclip, Link as LinkIcon, FileText } from '@/components/ds/icons';
import { PageIcon } from '@/components/ui/page-icon';
import { cn } from '@/lib/cn';
import { toBlocks, type Block } from '@/lib/blocks';
import { coverCss, isImageCover, coverAttachmentId } from '@/lib/covers';
import { useAttachmentUrl } from '@/lib/use-attachment';
import { CoverPickerBody } from '@/components/documents/cover-picker';
import { paletteFor } from '@/lib/palette';
import { COLLECTION_PAGE_TYPE, readCollection, ITEM_KIND_LABEL } from '@/lib/collection';
import type { DocGroup } from '@/lib/doc-recency';
import type { IconType } from '@/components/ds/icons';
import type { Folder, Page } from '@/components/documents/documents-view';

export type DocIndexProps = {
  groups: DocGroup<Page>[];
  layout: 'grid' | 'list';
  /** Show the group headings (off for Trash and Templates, which are not about recency). */
  headings: boolean;
  folders: Folder[];
  renamingId: string | null;
  typeIcon: (t: string) => IconType;
  ago: (iso: string) => string;
  onOpen: (p: Page) => void;
  onRenameTo: (p: Page, title: string) => void;
  onCancelRename: () => void;
  /** The hover controls for one doc (rename + menu, or restore + delete in Trash). */
  actions: (p: Page) => ReactNode;
  /** Set or remove a doc's cover from its tile. Absent in Trash, where nothing is edited. */
  onCover?: (p: Page, cover: string | undefined) => void;
};

export function DocIndex({ groups, layout, headings, ...rest }: DocIndexProps) {
  return (
    <div className={cn('flex flex-col gap-6', layout === 'list' && 'mx-auto w-full max-w-[960px]')}>
      {groups.map((g) => (
        <section key={g.id} aria-label={headings ? g.label : undefined}>
          {headings && (
            // The house group label (Habits uses the same): sentence case, overline role,
            // the count beside it in tabular figures so the heading never shifts as it changes.
            <h2 className="mb-2 flex items-center gap-1 px-0.5 text-overline text-ink-500">
              {g.label}
              <span className="tabular-nums">{g.items.length}</span>
            </h2>
          )}
          {layout === 'list' ? (
            // ONE panel per group, rows separated by a hairline. The previous list drew every
            // row as its own bordered card — fifteen boxes stacked 6px apart, which is the
            // fill-on-fill CLAUDE.md forbids, and the reason the list read as busy as the grid.
            <div className={cardClass('overflow-hidden')}>
              {g.items.map((p) => <DocRow key={p.id} p={p} {...rest} />)}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {g.items.map((p) => <DocTile key={p.id} p={p} {...rest} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

type ItemProps = Omit<DocIndexProps, 'groups' | 'layout' | 'headings'> & { p: Page };

/** The page's first line of prose — what the list row shows after the title. */
function excerptOf(blocks: Block[]): string {
  const b = blocks.find((x) => x.text.trim() && !['h1', 'h2', 'h3', 'code'].includes(x.type));
  return b ? b.text.trim().replace(/\s+/g, ' ') : '';
}

function Title({ p, renaming, onOpen, onRenameTo, onCancelRename, className }: {
  p: Page; renaming: boolean; onOpen: () => void; onRenameTo: (t: string) => void; onCancelRename: () => void; className?: string;
}) {
  if (renaming) {
    return (
      <TextInput size="sm" autoFocus defaultValue={p.title ?? ''} aria-label="Rename document"
        autoComplete="off" data-1p-ignore data-lpignore="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onRenameTo((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') onCancelRename();
        }}
        onBlur={(e) => onRenameTo(e.target.value)} />
    );
  }
  const untitled = !p.title?.trim();
  return (
    // The title is the row's real control (a button), so it is focusable and Enter opens the
    // doc; the row around it is a mouse convenience. "Untitled" is set in the QUIET ink, so a
    // page of real titles is not flattened by the ones nobody named yet.
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} title={p.title || 'Untitled'}
      className={cn('focus-ring min-w-0 truncate rounded-xs text-left text-ui font-medium [@media(pointer:coarse)]:min-h-6', untitled ? 'text-ink-500' : 'text-ink-900', className)}>
      {p.title || 'Untitled'}
    </button>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {tags.slice(0, 2).map((t) => (
        // A solid ink step, not a faded one (CLAUDE.md: never fade text with opacity). The old
        // chip painted `color-mix(… var(--ink) 72%, transparent)`.
        <span key={t} className="inline-flex h-5 items-center gap-1 rounded-xs border border-line bg-paper px-1.5 text-caption text-ink-700">
          <Icon icon={Tag} size={12} weight="fill" style={{ color: paletteFor(t).dot }} />
          {t}
        </span>
      ))}
    </span>
  );
}

function DocRow({ p, folders, renamingId, typeIcon, ago, onOpen, onRenameTo, onCancelRename, actions }: ItemProps) {
  const blocks = useMemo(() => toBlocks(p.content), [p.content]);
  const excerpt = useMemo(() => excerptOf(blocks), [blocks]);
  const folder = p.folder_id ? folders.find((f) => f.id === p.folder_id)?.name : undefined;
  return (
    <div onClick={() => onOpen(p)}
      // `doc-row` reveals the hover controls (documents-view.tsx <style>). It is NOT `doc-card`:
      // that class lifts a card on hover, and a row in a panel only ever takes a wash.
      className="doc-row group relative flex h-[var(--row-table)] cursor-pointer items-center gap-3 border-t border-line-soft px-[var(--panel-px)] transition-colors first:border-t-0 hover:bg-surface-hover">
      <span className="grid size-5 shrink-0 place-items-center text-ink-500">
        {p.icon ? <PageIcon icon={p.icon} size={16} /> : <Icon icon={typeIcon(p.type)} size={16} />}
      </span>
      <Title p={p} renaming={renamingId === p.id} onOpen={() => onOpen(p)}
        onRenameTo={(t) => onRenameTo(p, t)} onCancelRename={onCancelRename} className="max-w-[45%] shrink-0" />
      {p.is_favorite && <Icon icon={Star} size={12} weight="fill" className="shrink-0 text-accent-text" aria-label="Starred" />}
      {/* The first line — the second thing you recognise a doc by. It absorbs the free width,
          and goes first when the row narrows: it is useful, never essential. */}
      <span className="hidden min-w-0 flex-1 truncate text-ui text-ink-500 md:block">{excerpt}</span>
      <span className="flex-1 md:hidden" />
      <span className="hidden xl:flex"><Tags tags={p.tags ?? []} /></span>
      {folder && <span className="hidden w-32 shrink-0 truncate text-right text-caption text-ink-500 lg:block">{folder}</span>}
      <span className="w-16 shrink-0 text-right text-caption tabular-nums text-ink-500">{ago(p.updated_at)}</span>
      <span className="shrink-0" onClick={(e) => e.stopPropagation()}>{actions(p)}</span>
    </div>
  );
}

function DocTile({ p, folders, renamingId, typeIcon, ago, onOpen, onRenameTo, onCancelRename, actions, onCover }: ItemProps) {
  const folder = p.folder_id ? folders.find((f) => f.id === p.folder_id)?.name : undefined;
  return (
    <div onClick={() => onOpen(p)}
      // THE openable card (components/ds/ui/card.tsx): one hover language, a wash over the fill —
      // never a thickening border or a lift. `doc-tile` only reveals the hover controls.
      className={cardInteractiveClass('doc-tile group relative flex flex-col overflow-hidden')}>
      <div className="relative aspect-[16/10] overflow-hidden border-b border-line-soft bg-surface-band">
        <DocMiniature p={p} />
        {onCover && <span className="absolute left-2 top-2"><CoverControl p={p} onCover={onCover} /></span>}
        <span className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>{actions(p)}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="grid size-4 shrink-0 place-items-center text-ink-500">
            {p.icon ? <PageIcon icon={p.icon} size={14} /> : <Icon icon={typeIcon(p.type)} size={14} />}
          </span>
          <Title p={p} renaming={renamingId === p.id} onOpen={() => onOpen(p)}
            onRenameTo={(t) => onRenameTo(p, t)} onCancelRename={onCancelRename} />
          {p.is_favorite && <Icon icon={Star} size={12} weight="fill" className="ms-auto shrink-0 text-accent-text" aria-label="Starred" />}
        </div>
        <span className="truncate ps-5.5 text-caption text-ink-500">
          {folder ? `${folder} · ${ago(p.updated_at)}` : ago(p.updated_at)}
        </span>
      </div>
    </div>
  );
}

// ── The page thumbnail ──────────────────────────────────────────────────────────
// A page lying on the desk: a RAISED sheet on the tile's band — white in light, and in dark the
// lighter step (`surface-raised`, not `paper`: in dark `paper` sits BELOW the band and measured as
// a hole, #21201E on #2C2B29) — oversized and cut off at the bottom edge, the house's own picture
// grammar (one lifted thing, larger than its frame).
//
// WHAT IS ON IT IS THE REAL DOCUMENT (user, 2026-09-30: "I like the page concept in thumbnails,
// but show the actual data they write"). The first version drew each block as an abstract bar,
// and a row of grey bars says "a document" without saying WHICH one. So the page is laid out at a
// fixed document width, in document typography — the title in the title face, headings, lists,
// to-dos ticked or not, the real images — and then SCALED as one picture to fit the sheet, through
// a container query (`scale: calc(100cqw / PAGE_W)`), the same mechanism the website scales its
// pictures with. Scaled rather than shrunk type-by-type, so a heading stays a heading relative to
// its paragraph at every tile width.

/** The width the page is laid out at before it is scaled to the sheet. ~0.84× at a 280px tile. */
const PAGE_W = 280;
/** Enough blocks to fill the sheet; the rest is below the cut and never rendered. */
const MAX_BLOCKS = 10;

const substantive = (b: Block) =>
  !!b.text.trim() || ['image', 'video', 'embed', 'bookmark', 'pdf', 'file', 'audio', 'divider', 'table', 'page', 'code'].includes(b.type);

function DocMiniature({ p }: { p: Page }) {
  const { blocks, cover } = useMemo(() => {
    const c = p.content;
    const meta = c && !Array.isArray(c) ? (c as Record<string, unknown>) : null;
    return { blocks: toBlocks(c).filter(substantive).slice(0, MAX_BLOCKS), cover: typeof meta?.cover === 'string' ? meta.cover : undefined };
  }, [p.content]);
  const untitled = !p.title?.trim();

  // A numbered list counts from 1 at each run, as the editor does.
  let run = 0;
  const numbers = blocks.map((b, i) => {
    if (b.type !== 'numbered') { run = 0; return 0; }
    run = i > 0 && blocks[i - 1].type === 'numbered' ? run + 1 : 1;
    return run;
  });

  return (
    <div aria-hidden className="absolute inset-x-[8%] -bottom-3 top-[12%] overflow-hidden rounded-t-md border border-line-soft bg-surface-raised shadow-[var(--shadow-xs)]"
      style={{ containerType: 'inline-size' }}>
      <div style={{ width: PAGE_W, scale: `calc(100cqw / ${PAGE_W}px)`, transformOrigin: '0 0' }}>
        {cover && <MiniCover cover={cover} />}
        <div className="flex flex-col gap-1.5 px-5 pb-6 pt-4">
          {p.icon && <span className="mb-0.5 leading-none"><PageIcon icon={p.icon} size={24} /></span>}
          {/* The doc's own title face (Rubik, CLAUDE.md: titles). Untitled is drawn as the editor's
              empty title is — present, and quiet. */}
          <div className={cn('text-[20px] font-semibold leading-tight', untitled ? 'text-ink-500' : 'text-ink-900')}
            style={{ fontFamily: 'var(--font-title)' }}>
            {p.title?.trim() || 'Untitled'}
          </div>
          {p.type === COLLECTION_PAGE_TYPE
            ? <MiniCollection content={p.content} />
            : blocks.map((b, i) => <MiniBlock key={b.id} b={b} n={numbers[i]} />)}
        </div>
      </div>
    </div>
  );
}

function MiniCover({ cover }: { cover: string }) {
  // An uploaded cover is an attachment in a private bucket, so it is resolved to a signed address
  // (the same hook the editor's cover uses); a pasted link or an old inline data-URL is drawn as is.
  const attachmentId = coverAttachmentId(cover);
  const { url: signed } = useAttachmentUrl(attachmentId);
  if (isImageCover(cover)) {
    const src = attachmentId ? signed : cover;
    return src
      // eslint-disable-next-line @next/next/no-img-element -- a user's cover: any host, and a signed URL next/image cannot cache
      ? <img src={src} alt="" draggable={false} className="block h-[72px] w-full object-cover" loading="lazy" />
      : <div className="h-[72px] bg-surface-fill" />;
  }
  // A preset cover is the doc's content (the person chose it), drawn in its own colours.
  return <div className="h-[72px]" style={{ background: coverCss(cover) }} />;
}

function MiniImage({ b }: { b: Block }) {
  const { url: signed } = useAttachmentUrl(b.fileId);
  // `blob:` addresses die with the tab that made them, so only durable ones are drawn.
  const src = b.src && /^(data:|https:)/.test(b.src) ? b.src : signed;
  return src
    // eslint-disable-next-line @next/next/no-img-element -- a user's image: any host, or a signed URL next/image cannot cache
    ? <img src={src} alt="" draggable={false} className="block max-h-[120px] w-full rounded-md object-cover" loading="lazy" />
    : <div className="grid h-16 place-items-center rounded-md bg-surface-fill text-ink-500"><Icon icon={ImageIcon} size={16} /></div>;
}

const hostOf = (u?: string) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };

/** One block of the real document, in document typography (scene pixels: the page is scaled as one). */
function MiniBlock({ b, n }: { b: Block; n: number }) {
  const t = b.text.trim();
  const indent = b.indent ? { marginInlineStart: Math.min(b.indent, 3) * 14 } : undefined;
  switch (b.type) {
    case 'h1': return <div className="mt-2 text-[16px] font-semibold leading-snug text-ink-900">{t}</div>;
    case 'h2': return <div className="mt-1.5 text-[14px] font-semibold leading-snug text-ink-900">{t}</div>;
    case 'h3': return <div className="mt-1 text-[13px] font-semibold leading-snug text-ink-800">{t}</div>;
    case 'bullet': case 'numbered': case 'toggle':
      return (
        <div className="flex gap-1.5 text-[12.5px] leading-[1.45] text-ink-700" style={indent}>
          <span className="w-3 shrink-0 text-ink-500">{b.type === 'numbered' ? `${n}.` : b.type === 'toggle' ? '▸' : '•'}</span>
          <span className="line-clamp-2 min-w-0">{t}</span>
        </div>
      );
    case 'todo': case 'accept':
      return (
        <div className="flex items-start gap-1.5 text-[12.5px] leading-[1.45]" style={indent}>
          <span className={cn('mt-[3px] grid size-3 shrink-0 place-items-center rounded-[3px] border', b.checked ? 'border-ink-700 bg-ink-700 text-onsolid' : 'border-ink-400')}>
            {b.checked && <Icon icon={Check} size={12} weight="bold" className="size-2.5" />}
          </span>
          <span className={cn('line-clamp-2 min-w-0', b.checked ? 'text-ink-500 line-through' : 'text-ink-700')}>{t}</span>
        </div>
      );
    case 'quote':
      return <div className="line-clamp-3 border-l-2 border-line-strong pl-2 text-[12.5px] italic leading-[1.45] text-ink-700">{t}</div>;
    case 'callout':
      return <div className="line-clamp-3 rounded-md bg-surface-fill px-2 py-1.5 text-[12.5px] leading-[1.45] text-ink-700">{t}</div>;
    case 'code':
      return <div className="line-clamp-3 whitespace-pre-wrap rounded-md bg-surface-fill px-2 py-1.5 font-mono text-[11px] leading-[1.45] text-ink-700">{t}</div>;
    case 'divider':
      return <hr className="my-1 border-line-soft" />;
    case 'image':
      return <MiniImage b={b} />;
    case 'video': case 'embed': case 'bookmark': case 'pdf': case 'file': case 'audio':
      return (
        <div className="flex items-center gap-1.5 rounded-md border border-line-soft px-2 py-1.5 text-[11px] text-ink-700">
          <Icon icon={b.type === 'video' ? Play : b.type === 'pdf' || b.type === 'file' ? Paperclip : LinkIcon} size={12} className="shrink-0 text-ink-500" />
          <span className="truncate">{b.fileName || t || hostOf(b.src) || 'Attachment'}</span>
        </div>
      );
    case 'table': {
      const rows = (b.rows ?? []).slice(0, 4);
      if (!rows.length) return null;
      return (
        <div className="overflow-hidden rounded-md border border-line-soft text-[10.5px] text-ink-700">
          {rows.map((r, i) => (
            <div key={i} className={cn('grid grid-cols-3', i > 0 && 'border-t border-line-soft', i === 0 && 'font-semibold text-ink-900')}>
              {r.slice(0, 3).map((c, j) => <span key={j} className={cn('truncate px-1.5 py-1', j > 0 && 'border-l border-line-soft')}>{c}</span>)}
            </div>
          ))}
        </div>
      );
    }
    case 'page':
      return <div className="flex items-center gap-1.5 text-[12.5px] text-ink-700"><Icon icon={FileText} size={12} className="text-ink-500" /><span className="underline decoration-line-strong underline-offset-2">{t || 'Page'}</span></div>;
    default:
      return t ? <div className="line-clamp-3 text-[12.5px] leading-[1.45] text-ink-700">{t}</div> : null;
  }
}

/** A collection's real content is its items: their own pictures and names. */
function MiniCollection({ content }: { content: Page['content'] }) {
  const items = useMemo(() => readCollection(content).items.slice(0, 6), [content]);
  if (!items.length) return null;
  return (
    <div className="mt-1 grid grid-cols-3 gap-1.5">
      {items.map((it) => (
        it.image && it.image.startsWith('https:')
          // eslint-disable-next-line @next/next/no-img-element -- a saved item's own preview, from its own site
          ? <img key={it.id} src={it.image} alt="" draggable={false} className="aspect-square w-full rounded-sm object-cover" loading="lazy" />
          : (
            <div key={it.id} className="flex aspect-square flex-col justify-end rounded-sm bg-surface-fill p-1.5">
              <span className="line-clamp-3 text-[10px] leading-tight text-ink-700">{it.title || it.note || hostOf(it.url) || ITEM_KIND_LABEL[it.kind]}</span>
            </div>
          )
      ))}
    </div>
  );
}

// ── Setting a cover from the gallery ─────────────────────────────────────────────
// User, 2026-09-30: "give option to set cover". The editor already had the picker; a tile now opens
// the SAME picker body (CoverPickerBody) in the DS's portalled Popover — the editor's panel is
// `position: absolute` and a tile clips its overflow, so hosting that panel here would have sliced
// it at the tile's edge.
function CoverControl({ p, onCover }: { p: Page; onCover: (p: Page, cover: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const c = p.content;
  const current = c && !Array.isArray(c) && typeof (c as Record<string, unknown>).cover === 'string' ? (c as Record<string, string>).cover : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()}
          aria-label={current ? 'Change cover' : 'Add cover'} title={current ? 'Change cover' : 'Add cover'}
          data-open={open ? 'true' : undefined}
          className="doc-cardmenu focus-ring zb-press inline-flex h-[26px] items-center gap-1 rounded-sm border border-line bg-surface-raised px-2 text-caption text-ink-700 hover:text-ink-900">
          <Icon icon={ImageIcon} size={14} />
          {current ? 'Cover' : 'Add cover'}
        </button>
      </PopoverTrigger>
      {/* A portalled popover still bubbles its React clicks to the tile, which would open the doc
          under the picker as a cover was chosen (DS gotchas: a portalled menu's click bubbles to
          its clickable card). The content stops them here. */}
      <PopoverContent flush align="start" onClick={(e) => e.stopPropagation()}>
        <CoverPickerBody current={current} attachTo={{ page_id: p.id }}
          onPick={(cover) => onCover(p, cover)}
          onRemove={current ? () => onCover(p, undefined) : undefined}
          onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
