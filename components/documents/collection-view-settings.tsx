'use client';
// How a Collection shows itself (COLLECTION_PLAN K11; COLLECTION_VIEW_BRIEF §28).
//
// Three settings, and they belong to the COLLECTION, not to the person looking at it: a moodboard someone
// arranged as large uncropped pictures is that board for everyone who opens it. They are saved the way the
// order is (`store.learn`), because how a thing is shown is not a step in what was done to it.
//
// §28 also lists Layout (masonry | grid). It is not a fourth setting: "Original ratio" IS the masonry §13 asks
// for, and either uniform preview IS the grid. One choice, not two that can disagree.
import { useState } from 'react';
import { Check, SlidersHorizontal } from '@/components/ds/icons';
import { Icon, IconButton, Switch } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import {
  CARD_SIZES, CARD_SIZE_LABEL, PREVIEW_FITS, PREVIEW_FIT_LABEL, type CollectionView,
} from '@/lib/collection';
import { Pop, POP_LABEL, POP_ROW, POP_SEPARATOR } from './db-pop';

export function CollectionViewSettings({ view, onView }: {
  view: Required<CollectionView>;
  onView: (patch: CollectionView) => void;
}) {
  const [open, setOpen] = useState(false);
  const ordinary = view.size === 'medium' && view.fit === 'original' && view.titles;
  return (
    <div className="relative">
      <IconButton size="sm" label="View settings" selected={open || !ordinary} aria-expanded={open}
        icon={<Icon icon={SlidersHorizontal} size={16} />} onClick={() => setOpen((v) => !v)} />
      {open && (
        <Pop onClose={() => setOpen(false)} right width={220}>
          <div role="radiogroup" aria-label="Card size">
            <div className={POP_LABEL}>Card size</div>
            {CARD_SIZES.map((size) => (
              <Row key={size} on={view.size === size} label={CARD_SIZE_LABEL[size]} onClick={() => onView({ size })} />
            ))}
          </div>
          <div aria-hidden className={POP_SEPARATOR} />
          <div role="radiogroup" aria-label="Preview">
            <div className={POP_LABEL}>Preview</div>
            {PREVIEW_FITS.map((fit) => (
              <Row key={fit} on={view.fit === fit} label={PREVIEW_FIT_LABEL[fit]} onClick={() => onView({ fit })} />
            ))}
          </div>
          <div aria-hidden className={POP_SEPARATOR} />
          {/* A note is nothing but its words, so it keeps them whatever this says. */}
          <label className={cn(POP_ROW, 'cursor-default justify-between')}>
            <span className="min-w-0 flex-1 truncate">Show titles</span>
            <Switch checked={view.titles} onCheckedChange={(titles) => onView({ titles })} />
          </label>
        </Pop>
      )}
    </div>
  );
}

/** One of a set — the same row the Filter panel uses, so one bar has one vocabulary. */
function Row({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cn('zb-press', POP_ROW)}>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {on && <Icon icon={Check} size={16} className="shrink-0 text-ink-600" />}
    </button>
  );
}
