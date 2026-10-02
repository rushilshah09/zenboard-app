// THE record header — how every entity introduces itself.
//
// A project, a client, an invoice and a form are different records, but they
// open the same way: a mark that identifies the thing, its name as the page's
// H1, then a short block of labelled properties before any content starts. That
// shape is the app's entity-detail pattern, and it was written out twice before
// it was ever named — Projects and Clients each carried their OWN `PropRow`,
// character for character identical:
//
//     <div className="flex min-h-8 items-center gap-2">
//       <span className="flex w-[124px] shrink-0 items-center gap-2 text-ui text-ink-500">
//
// Two identical private copies is the state just before a divergence, not a
// coincidence — and the title rows above them had ALREADY diverged, one on
// `gap-2.5` and the other on `gap-3`, for no reason either file could name.
//
// ── WHAT VARIES, AND WHAT MUST NOT ──────────────────────────────────────────
// The IDENTITY MARK varies and should: a project is identified by its colour, a
// client by their initials, a document by its icon. That is the record telling
// you what kind of thing it is, and flattening it would lose information. So it
// is a slot.
//
// Everything else is fixed here: the 14px gap between mark and name, the H1, the
// 124px label column, the icon size and its ink, the label/value colours, the
// row's 32px minimum, and the space between the property block and whatever
// follows. Those carry no information about the record — they are just the
// shape a Zenboard record has — and a screen that answers them for itself is
// how "the same entity in two different products" happens.
import type { ReactNode } from 'react';
import { type IconType } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui/icon';
import { cn } from '@/lib/cn';

/**
 * THE measurements of a property row, named so a second composition cannot
 * drift from them.
 *
 * The paragraph above lists what must not vary — the 124px label column, the
 * 16px icon and its ink, the label/value colours, the row's 32px minimum — and
 * for one composition a class string states that fine. There are two now: the
 * plain row below, and the MANAGEABLE row in components/records/property-block,
 * whose label is a menu trigger and which reclaims a gutter for a drag handle.
 * Its internals genuinely differ; its dimensions must not, or a project's
 * header and a client's would sit on two different grids the moment one is
 * touched. Same conclusion workstream-controls reached about its own two
 * compositions: one set of rules, two arrangements.
 */
export const PROPERTY_ROW = {
  /** The row itself. */
  row: 'flex min-h-8 items-center gap-2',
  /** The label column — fixed width, so every value starts on one axis. */
  label: 'flex w-[124px] shrink-0 items-center gap-2 text-ui text-ink-500',
  /**
   * The same column when the label is a MENU TRIGGER, which needs room to draw
   * a hover chip around the text.
   *
   * The arithmetic, because getting it wrong is a 4px stagger between a
   * manageable header and a plain one — and because the first version of this
   * comment got it wrong before a test caught it. The chip is pulled LEFT by
   * `inset` and padded by `inset` on both sides, so:
   *
   *     text starts at   -inset + inset        = 0        ← the label axis
   *     right edge at    -inset + width        = column   ⇒ width = column + inset
   *
   * One inset, not two: the left padding is cancelled by the negative margin,
   * and only the right padding extends the box. 124 + 4 = 128.
   *
   * Spelled out rather than computed: Tailwind v4 generates from SOURCE TEXT, so
   * a class built from a variable produces no CSS at all.
   */
  labelTrigger: 'flex w-[128px] -ms-1 shrink-0 items-center gap-2 rounded-sm px-1 text-ui text-ink-500',
  /** What the trigger insets on each side. */
  inset: 4,
  /** The value. */
  value: 'min-w-0 text-ui flex-1 text-ink-800',
  /** The glyph beside a label. */
  iconSize: 16,
} as const;

/** One labelled property. The value is a node: a badge, a link, a progress bar. */
export function PropertyRow({ icon, label, children }: {
  icon: IconType; label: string; children: ReactNode;
}) {
  return (
    <div className={PROPERTY_ROW.row}>
      <span className={PROPERTY_ROW.label}>
        <Icon icon={icon} size={PROPERTY_ROW.iconSize} className="shrink-0 text-ink-500" strokeWidth={1.75} />{label}
      </span>
      <div className={PROPERTY_ROW.value}>{children}</div>
    </div>
  );
}

export function RecordHeader({ identity, title, children, className }: {
  /**
   * The mark that says WHICH KIND of record this is — a colour chip, an avatar,
   * a document icon. Kept a slot on purpose: it is the one part of this header
   * that carries information rather than shape.
   */
  identity?: ReactNode;
  title: ReactNode;
  /** The property rows. Use `<PropertyRow>`; nothing else belongs here. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {identity}
        <h1 className="text-balance text-h1 text-ink-900">{title}</h1>
      </div>
      {/* The property block sits directly under the title and above everything
          else — tabs included — so a record's facts are readable without
          choosing a section first. Projects established this; it is why the
          properties are OUTSIDE the tab panel, not the first tab's content. */}
      {children && <div className="mb-7 flex flex-col gap-px">{children}</div>}
    </div>
  );
}

/** A record's colour chip — the identity mark for anything that has a colour. */
export function RecordColorMark({ color }: { color?: string | null }) {
  return (
    <span
      aria-hidden
      className={cn('size-3.5 shrink-0 rounded-[4px]')}
      style={{ background: color ?? 'var(--color-ink-500)' }}
    />
  );
}
