'use client';
// The slash menu's hover preview — a small picture of what an entry makes, and one
// line saying so (Notion's preview card; the user asked for it "same to same").
//
// Drawn, not imported: every picture is a few token-coloured shapes on the
// page's own ground (`bg-paper`), so it follows light and dark with the rest of the app, costs no
// image bytes in a worker that lives under a 3 MiB ceiling, and stays crisp at any
// zoom. The card itself is the DS tooltip's inverse ground (`bg-ink-900` with
// `text-paper`) — dark on a light page, light on a dark one, as every tooltip is.
//
// Keyed by `menuKey`, so a new entry without a picture fails
// slash-previews.test.ts instead of quietly borrowing another entry's.
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ds/ui';
import {
  Check, ChevronRight, Image as ImageIcon, Play, Paperclip, CodeXml, Link as LinkIcon,
  Database, ModeFullPage, FileText,
} from '@/components/ds/icons';
import { menuKey, type BlockMenuItem } from '@/lib/blocks';
import { DrawnBar, DrawnChip, DrawnPageGlyph, DrawnRow } from '@/components/ds/ui/drawn';

// ── The kit ─────────────────────────────────────────────────────────────────
// A canvas the size of Notion's (140×100), and the three marks everything else
// is made from: a bar of text, a chip, a box.

function Canvas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn('flex h-[100px] w-[140px] flex-col gap-1.5 overflow-hidden rounded-md bg-paper p-3', className)}>
      {children}
    </div>
  );
}

// The marks themselves live in components/ds/ui/drawn.tsx now (2026-09-30): the Documents
// gallery draws its page miniatures with them too, and two private copies of "a bar of text"
// would drift the first time either was touched. Same names here, so nothing below changed.
const Bar = DrawnBar;
const Chip = DrawnChip;
const Page = DrawnPageGlyph;
const Row = DrawnRow;

// ── One picture per entry ───────────────────────────────────────────────────

function Heading({ size }: { size: string }) {
  return (
    <Canvas className="items-center justify-center">
      <span className={cn('font-semibold leading-none text-ink-900', size)}>How?</span>
    </Canvas>
  );
}

const tableGrid = (rows: number, cols: 2 | 3, header = true) => (
  <div className={cn('grid w-full overflow-hidden rounded-sm border border-line-soft', cols === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
    {Array.from({ length: rows * cols }, (_, i) => (
      <span
        key={i}
        className={cn(
          'flex h-4 items-center border-line-soft px-1',
          i % cols !== cols - 1 && 'border-r',
          i >= cols && 'border-t',
          header && i < cols && 'bg-surface-fill',
        )}
      >
        <Bar w={header && i < cols ? 'w-3/5' : i % cols === 0 ? 'w-4/5' : 'w-1/2'} strong={header && i < cols} />
      </span>
    ))}
  </div>
);

/** A database's rows: a title and a status chip, under a header. */
const databaseTable = (
  <div className="flex w-full flex-col gap-1">
    <Row className="border-b border-line-soft pb-1"><Bar w="w-1/3" strong /><span className="flex-1" /><Bar w="w-1/4" strong /></Row>
    {['w-3/5', 'w-1/2', 'w-2/3', 'w-2/5'].map((w, i) => (
      <Row key={i}><Page /><Bar w={w} /><span className="flex-1" /><Chip w={i % 2 ? 'w-5' : 'w-6'} /></Row>
    ))}
  </div>
);

const PREVIEWS: Record<string, () => ReactNode> = {
  text: () => (
    <Canvas className="justify-center"><Bar /><Bar w="w-11/12" /><Bar /><Bar w="w-2/3" /></Canvas>
  ),
  // A page inside a page: writing, then a line that IS a page — its glyph and its name.
  page: () => (
    <Canvas className="justify-center gap-2">
      <Bar w="w-4/5" /><Bar w="w-3/5" />
      <Row className="gap-1"><Icon icon={FileText} size={12} className="text-ink-600" /><Bar w="w-2/5" strong className="h-2" /></Row>
      <Bar w="w-2/3" />
    </Canvas>
  ),
  h1: () => <Heading size="text-title-2" />,
  h2: () => <Heading size="text-title-4" />,
  h3: () => <Heading size="text-ui" />,
  bullet: () => (
    <Canvas className="justify-center">
      {['w-4/5', 'w-3/5', 'w-2/3'].map((w, i) => (
        <Row key={i}><span className="size-1 shrink-0 rounded-full bg-ink-500" /><Bar w={w} /></Row>
      ))}
    </Canvas>
  ),
  numbered: () => (
    <Canvas className="justify-center">
      {['w-4/5', 'w-3/5', 'w-2/3'].map((w, i) => (
        <Row key={i}><span className="w-2 shrink-0 text-caption leading-none text-ink-500">{i + 1}.</span><Bar w={w} /></Row>
      ))}
    </Canvas>
  ),
  todo: () => (
    <Canvas className="justify-center">
      {[true, false, false].map((done, i) => (
        <Row key={i}>
          <span className={cn('grid size-3 shrink-0 place-items-center rounded-[3px] border', done ? 'border-ink-900 bg-ink-900 text-paper' : 'border-ink-400')}>
            {done && <Icon icon={Check} size={12} />}
          </span>
          <Bar w={['w-2/3', 'w-4/5', 'w-1/2'][i]} strong={!done} />
        </Row>
      ))}
    </Canvas>
  ),
  toggle: () => (
    <Canvas className="justify-center">
      <Row><Icon icon={ChevronRight} size={12} className="rotate-90 text-ink-600" /><Bar w="w-3/5" strong /></Row>
      <div className="flex flex-col gap-1.5 pl-4"><Bar w="w-4/5" /><Bar w="w-3/5" /></div>
      <Row><Icon icon={ChevronRight} size={12} className="text-ink-600" /><Bar w="w-1/2" strong /></Row>
    </Canvas>
  ),
  callout: () => (
    <Canvas className="justify-center">
      <div className="flex gap-2 rounded-sm bg-surface-fill p-2">
        <span className="mt-px size-2.5 shrink-0 rounded-full bg-ink-300" />
        <div className="flex flex-1 flex-col gap-1.5"><Bar w="w-full" /><Bar w="w-3/4" /></div>
      </div>
    </Canvas>
  ),
  quote: () => (
    <Canvas className="justify-center">
      <div className="flex flex-col gap-1.5 border-l-2 border-ink-900 pl-2"><Bar w="w-full" /><Bar w="w-5/6" /><Bar w="w-1/2" /></div>
    </Canvas>
  ),
  table: () => <Canvas className="justify-center">{tableGrid(3, 3)}</Canvas>,
  divider: () => (
    <Canvas className="justify-center"><Bar w="w-4/5" /><Bar w="w-3/5" /><span className="my-1 block h-px w-full bg-line-strong" /><Bar w="w-2/3" /><Bar w="w-1/2" /></Canvas>
  ),
  image: () => (
    <Canvas className="p-2">
      <div className="grid flex-1 place-items-center rounded-sm bg-surface-fill text-ink-500"><Icon icon={ImageIcon} size={20} /></div>
      <Bar w="w-1/2" className="mx-auto" />
    </Canvas>
  ),
  video: () => (
    <Canvas className="p-2">
      <div className="grid flex-1 place-items-center rounded-sm bg-ink-900 text-paper">
        <span className="grid size-6 place-items-center rounded-full bg-ink-700"><Icon icon={Play} size={12} /></span>
      </div>
    </Canvas>
  ),
  audio: () => (
    <Canvas className="justify-center">
      <div className="flex items-center gap-2 rounded-sm bg-surface-fill px-2 py-2.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink-900 text-paper"><Icon icon={Play} size={12} /></span>
        <div className="flex h-4 flex-1 items-center gap-[2px]">
          {['h-1', 'h-2.5', 'h-1.5', 'h-3.5', 'h-2', 'h-4', 'h-2.5', 'h-1.5', 'h-3', 'h-1', 'h-2', 'h-3.5', 'h-1.5', 'h-1'].map((h, i) => (
            <span key={i} className={cn('block w-[2px] rounded-full bg-ink-400', h)} />
          ))}
        </div>
      </div>
    </Canvas>
  ),
  code: () => (
    <Canvas className="justify-center">
      <div className="flex flex-col gap-1.5 rounded-sm bg-surface-fill p-2">
        <Row><Icon icon={CodeXml} size={12} className="text-ink-500" /><Bar w="w-2/5" strong /></Row>
        <Bar w="w-4/5" className="ml-3" /><Bar w="w-3/5" className="ml-3" /><Bar w="w-1/4" strong />
      </div>
    </Canvas>
  ),
  file: () => (
    <Canvas className="justify-center">
      <Row className="rounded-sm bg-surface-fill px-2 py-2"><Icon icon={Paperclip} size={12} className="text-ink-600" /><Bar w="w-3/5" strong /><span className="flex-1" /><Bar w="w-4" /></Row>
    </Canvas>
  ),
  pdf: () => (
    <Canvas className="items-center justify-center">
      <div className="flex h-[74px] w-[56px] flex-col gap-1 rounded-sm border border-line-strong bg-paper p-1.5">
        <Bar w="w-2/3" strong /><Bar /><Bar w="w-4/5" /><Bar /><Bar w="w-1/2" />
      </div>
    </Canvas>
  ),
  bookmark: () => (
    <Canvas className="justify-center">
      <div className="flex overflow-hidden rounded-sm border border-line-soft">
        <div className="flex flex-1 flex-col gap-1.5 p-2"><Bar w="w-4/5" strong /><Bar w="w-full" /><Row><Icon icon={LinkIcon} size={12} className="text-ink-500" /><Bar w="w-1/2" /></Row></div>
        <div className="w-10 shrink-0 bg-surface-fill" />
      </div>
    </Canvas>
  ),
  embed: () => (
    <Canvas className="p-2">
      <div className="flex flex-1 flex-col overflow-hidden rounded-sm border border-line-soft">
        <div className="flex gap-1 border-b border-line-soft bg-surface-fill px-1.5 py-1">
          {[0, 1, 2].map((i) => <span key={i} className="size-1 rounded-full bg-ink-300" />)}
        </div>
        <div className="grid flex-1 place-items-center text-ink-500"><Icon icon={CodeXml} size={16} /></div>
      </div>
    </Canvas>
  ),
  'collection:table': () => <Canvas className="justify-center">{databaseTable}</Canvas>,
  'collection:board': () => (
    <Canvas className="flex-row gap-1.5 p-2">
      {[3, 2, 1].map((cards, c) => (
        <div key={c} className="flex flex-1 flex-col gap-1 rounded-sm bg-surface-fill p-1">
          <Chip w={['w-6', 'w-5', 'w-4'][c]} />
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-[3px] border border-line-soft bg-paper p-1"><Bar w="w-4/5" strong /><Chip w="w-3" /></div>
          ))}
        </div>
      ))}
    </Canvas>
  ),
  'collection:gallery': () => (
    <Canvas className="grid grid-cols-2 gap-1.5 p-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-[3px] border border-line-soft">
          <span className="block h-5 bg-surface-fill" />
          <span className="flex items-center px-1 py-1"><Bar w={i % 2 ? 'w-1/2' : 'w-3/4'} strong /></span>
        </div>
      ))}
    </Canvas>
  ),
  'collection:list': () => (
    <Canvas className="justify-center gap-2">
      {['w-3/5', 'w-2/5', 'w-1/2', 'w-2/3'].map((w, i) => (
        <Row key={i}><Page /><Bar w={w} strong={i === 0} /><span className="flex-1" /><Bar w="w-4" /></Row>
      ))}
    </Canvas>
  ),
  'collection:calendar': () => (
    <Canvas className="gap-1 p-2">
      <Row><Bar w="w-1/3" strong /></Row>
      <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-[3px] border border-line-soft bg-line-soft">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="flex flex-col justify-end bg-paper p-[2px]">
            {(i === 9 || i === 17 || i === 18) && <span className="block h-1 rounded-full bg-ink-400" />}
          </span>
        ))}
      </div>
    </Canvas>
  ),
  // A Collection: pictures first, at their own heights — a page of references.
  'page:collection': () => (
    <Canvas className="grid grid-cols-3 items-start gap-1.5 p-2">
      {[['h-8', 'h-4'], ['h-4', 'h-8'], ['h-6', 'h-5']].map((column, c) => (
        <div key={c} className="flex flex-col gap-1.5">
          {column.map((h, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-[3px] border border-line-soft">
              <span className={`block bg-surface-fill ${h}`} />
              <span className="flex items-center px-1 py-[3px]"><Bar w={(c + i) % 2 ? 'w-1/2' : 'w-3/4'} strong /></span>
            </div>
          ))}
        </div>
      ))}
    </Canvas>
  ),
  // Bars across a strip of days, one per page, today a line through them.
  'collection:timeline': () => (
    <Canvas className="relative justify-center gap-2">
      <Row className="gap-0"><Bar w="w-full" className="h-1 bg-line-soft" /></Row>
      {[['ml-0', 'w-1/2'], ['ml-6', 'w-2/5'], ['ml-3', 'w-3/5'], ['ml-10', 'w-1/3']].map(([ml, w], i) => (
        <span key={i} className={cn('block h-2.5 shrink-0 rounded-sm border border-line-strong bg-surface-raised', ml, w)} />
      ))}
      <span aria-hidden className="absolute bottom-3 left-[58%] top-3 w-px bg-ink-500" />
    </Canvas>
  ),
  'collection:inline': () => (
    <Canvas className="gap-2">
      <Bar w="w-4/5" /><Bar w="w-2/5" strong />
      {databaseTable}
    </Canvas>
  ),
  'collection:fullpage': () => (
    <Canvas className="gap-1.5 p-2">
      <div className="flex flex-1 flex-col gap-1.5 rounded-sm border border-line-soft p-1.5">
        <Row><Icon icon={Database} size={12} className="text-ink-500" /><Bar w="w-2/5" strong /><span className="flex-1" /><Icon icon={ModeFullPage} size={12} className="text-ink-500" /></Row>
        {tableGrid(3, 2, true)}
      </div>
    </Canvas>
  ),
  'collection:linked': () => (
    <Canvas className="justify-center">
      <Row><Icon icon={LinkIcon} size={12} className="text-ink-500" /><Bar w="w-1/3" strong /></Row>
      {databaseTable}
    </Canvas>
  ),
  lineitems: () => (
    <Canvas className="justify-center gap-2">
      {['w-1/2', 'w-2/5', 'w-3/5'].map((w, i) => (
        <Row key={i}><Bar w={w} /><span className="flex-1" /><Bar w="w-5" strong /></Row>
      ))}
      <Row className="border-t border-line-soft pt-2"><Bar w="w-1/4" strong /><span className="flex-1" /><Bar w="w-7" strong /></Row>
    </Canvas>
  ),
  accept: () => (
    <Canvas className="justify-center gap-2">
      <Bar w="w-4/5" /><Bar w="w-3/5" />
      <div className="flex items-end gap-2 pt-1">
        <span className="block h-4 flex-1 border-b border-ink-400" />
        <span className="block h-4 w-9 shrink-0 rounded-sm bg-ink-900" />
      </div>
    </Canvas>
  ),
};

/** Every key that has a picture — read by the test that holds coverage. */
export const PREVIEW_KEYS = Object.keys(PREVIEWS);

export function SlashPreview({ item }: { item: BlockMenuItem }) {
  const Picture = PREVIEWS[menuKey(item)] ?? PREVIEWS.text;
  return (
    <div className="w-[156px] rounded-lg bg-ink-900 p-2 shadow-lift-2">
      <Picture />
      <p className="px-0.5 pb-0.5 pt-2 text-meta leading-snug text-paper">{item.hint}</p>
    </div>
  );
}
