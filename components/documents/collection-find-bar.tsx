'use client';
// Finding and ordering a Collection (COLLECTION_PLAN K8; COLLECTION_VIEW_BRIEF §29, §31–32).
//
// The three controls a database's bar already carries, in the same order and the same clothes — Filter,
// Sort, and a quiet search that expands into an underline field — because narrowing a list is one act in
// Zenboard, whatever the list holds (CONSISTENCY_PRINCIPLE).
//
// They organise the GRID. The canvas is the arrangement of EVERYTHING: hiding an item there would leave a
// hole where someone deliberately put something, and the grid is where a Collection is read anyway.
import { useState } from 'react';
import { ArrowDownUp, Check, ListFilter, Search } from '@/components/ds/icons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
  Icon, IconButton,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { COLLECTION_SORTS, ITEM_KIND_LABEL, type CollectionDoc, type CollectionSort } from '@/lib/collection';
import {
  ADDED_LABEL, ADDED_WINDOWS, NO_FILTER, SORT_LABEL, isFiltering, kindsPresent, sourcesPresent,
  type AddedWindow, type CollectionFilter,
} from '@/lib/collection-find';
import { palette } from '@/lib/palette';
import { KIND_GLYPH } from './collection-card';
import { Pop, POP_LABEL, POP_ROW, POP_SEPARATOR } from './db-pop';

export function CollectionFindBar({ doc, query, onQuery, filter, onFilter, sort, onSort }: {
  doc: CollectionDoc;
  query: string;
  onQuery: (query: string) => void;
  filter: CollectionFilter;
  onFilter: (filter: CollectionFilter) => void;
  sort: CollectionSort;
  onSort: (sort: CollectionSort) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const kinds = kindsPresent(doc);
  const sources = sourcesPresent(doc);
  const tags = doc.tags ?? [];
  const narrowed = isFiltering('', filter);
  // A section is worth offering only when it can tell two things apart.
  const sections = [kinds.length > 1, sources.length > 1, tags.length > 0];
  const rule = (index: number) => sections.slice(0, index).some(Boolean);

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <>
      {/* Filter — Type, Source, Tags and when it was collected (§31). Only what this Collection has. */}
      <div className="relative">
        <IconButton size="sm" label="Filter" selected={filterOpen || narrowed} aria-expanded={filterOpen}
          icon={<Icon icon={ListFilter} size={16} />} onClick={() => setFilterOpen((v) => !v)} />
        {filterOpen && (
          <Pop onClose={() => setFilterOpen(false)} right width={240}>
            {sections[0] && (
              <div role="group" aria-label="Type">
                <div className={POP_LABEL}>Type</div>
                {kinds.map((kind) => (
                  <Row key={kind} on={filter.kinds.includes(kind)} onClick={() => onFilter({ ...filter, kinds: toggle(filter.kinds, kind) })}
                    icon={<Icon icon={KIND_GLYPH[kind]} size={16} className="text-ink-600" />} label={ITEM_KIND_LABEL[kind]} />
                ))}
              </div>
            )}
            {sections[1] && (
              <div role="group" aria-label="Source">
                {rule(1) && <div aria-hidden className={POP_SEPARATOR} />}
                <div className={POP_LABEL}>Source</div>
                {sources.map((source) => (
                  <Row key={source.key} on={filter.sources.includes(source.key)} label={source.label}
                    onClick={() => onFilter({ ...filter, sources: toggle(filter.sources, source.key) })} />
                ))}
              </div>
            )}
            {sections[2] && (
              <div role="group" aria-label="Tags">
                {rule(2) && <div aria-hidden className={POP_SEPARATOR} />}
                <div className={POP_LABEL}>Tags</div>
                {tags.map((tag) => (
                  <Row key={tag.id} on={filter.tags.includes(tag.id)} label={tag.name}
                    icon={<span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: palette(tag.color).dot }} />}
                    onClick={() => onFilter({ ...filter, tags: toggle(filter.tags, tag.id) })} />
                ))}
              </div>
            )}
            {/* One window at a time, so these are a choice and not four switches. */}
            <div role="radiogroup" aria-label="Collected">
              {rule(3) && <div aria-hidden className={POP_SEPARATOR} />}
              <div className={POP_LABEL}>Collected</div>
              <Row radio on={!filter.added} label="Any time" onClick={() => onFilter({ ...filter, added: undefined })} />
              {ADDED_WINDOWS.map((days: AddedWindow) => (
                <Row key={days} radio on={filter.added === days} label={ADDED_LABEL[days]}
                  onClick={() => onFilter({ ...filter, added: days })} />
              ))}
            </div>
            {narrowed && (
              <>
                <div aria-hidden className={POP_SEPARATOR} />
                <button type="button" className={cn('zb-press', POP_ROW, 'text-ink-700')}
                  onClick={() => { onFilter(NO_FILTER); setFilterOpen(false); }}>Clear filters</button>
              </>
            )}
          </Pop>
        )}
      </div>

      {/* Sort — the whole Collection read one way (§29). Manual is the one a carry can rearrange. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton size="sm" label="Sort" selected={sort !== 'manual'} icon={<Icon icon={ArrowDownUp} size={16} />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as CollectionSort)}>
            {COLLECTION_SORTS.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>{SORT_LABEL[value]}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search — the quiet icon that expands into an underline input, as a database's does. */}
      {searching || query ? (
        <input autoFocus value={query} onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { onQuery(''); setSearching(false); } }}
          onBlur={() => { if (!query.trim()) setSearching(false); }}
          placeholder="Search…" autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Search this collection"
          data-owns-escape
          className="h-[26px] w-40 border-0 border-b border-line-strong bg-transparent px-0.5 text-meta text-ink-900 outline-none" />
      ) : (
        <IconButton size="sm" label="Search" icon={<Icon icon={Search} size={16} />} onClick={() => setSearching(true)} />
      )}
    </>
  );
}

/** A panel row that is on or off — the option list's anatomy (a dot or a glyph, a name, a trailing check). */
function Row({ on, label, icon, radio, onClick }: {
  on: boolean; label: string; icon?: React.ReactNode; radio?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" role={radio ? 'radio' : 'checkbox'} aria-checked={on} onClick={onClick} className={cn('zb-press', POP_ROW)}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {on && <Icon icon={Check} size={16} className="shrink-0 text-ink-600" />}
    </button>
  );
}
