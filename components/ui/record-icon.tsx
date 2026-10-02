'use client';
// RecordIcon — how a project (or any coloured record) identifies itself.
//
// ── WHAT IT REPLACED ────────────────────────────────────────────────────────
// A 10px filled square in the record's colour. Five projects in a rail were
// five identical squares in five nearly-identical muted hues, so the colour
// carried almost no information — you still read the name every time — and a
// bare saturated dot beside 14px text reads as unfinished. The user's word for
// it was "amateur", and the reference they pointed at was Linear, which gives
// every project a TILE: a rounded square, the record's colour at low strength
// as the ground, and a glyph the person chose sitting on it.
//
// The tile does three things the dot could not:
//   · it holds a GLYPH, so the mark can say what the project is, not just
//     that it has been assigned a colour;
//   · it has area, so a muted hue is legible at a glance instead of being a
//     few pixels of near-grey;
//   · it gives the row a consistent leading edge whether or not an icon has
//     been chosen — a project with no icon gets the default glyph, never a
//     hole or a differently-sized mark.
//
// ── THE GROUND IS THE COLOUR AT 14% ─────────────────────────────────────────
// Not a separate "soft" token per hue. `--scope-*` is already theme-aware
// (lib/entity-color.ts exists because a stored hex measured 1.66:1 on a dark
// rail), and mixing it toward transparent keeps that property: the tint lands
// on whatever ground it is over, in whatever theme, and the glyph keeps
// roughly the contrast the colour was tuned for against that same ground.
// A fixed pale hex per hue would be the theme-blindness that file removed.
import { PageIcon, PAGE_ICONS } from '@/components/ui/page-icon';
import { Folder, type IconType } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui/icon';
import { scopeFill } from '@/lib/entity-color';
import { cn } from '@/lib/cn';

/** Tile / glyph / radius, in px. Three sizes, matching the row scale. */
const SIZES = {
  sm: { box: 20, glyph: 12, radius: 5 },   // rail rows, chips
  md: { box: 24, glyph: 14, radius: 6 },   // list rows, board headers
  lg: { box: 32, glyph: 18, radius: 8 },   // a record's own header
} as const;

export type RecordIconSize = keyof typeof SIZES;

export function RecordIcon({
  color, icon, size = 'sm', fallbackIcon = Folder, className, style,
}: {
  /** A scope colour name, or a legacy hex — `scopeFill` reads both. */
  color?: string | null;
  /** A page-icon value: an emoji, `ph:Name`, or an image URL. */
  icon?: string | null;
  size?: RecordIconSize;
  /**
   * The glyph for a record that has not been given one. Defaults to the
   * PROJECTS nav icon, so an un-iconed project's mark is the same glyph the
   * sidebar uses for the module it lives in — the icon seam's rule that nav
   * icons are one family, applied one level down. A client or a list passes
   * its own rather than inheriting a folder.
   */
  fallbackIcon?: IconType;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { box, glyph, radius } = SIZES[size];
  const fill = scopeFill(color);
  const isEmoji = !!icon && !icon.startsWith('ph:') && !icon.startsWith('data:') && !icon.startsWith('http');

  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center', className)}
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        // An EMOJI brings its own colour and does not want a hue behind it —
        // the tile stays neutral so the emoji reads as itself rather than as
        // a sticker on a coloured patch. Everything else sits on the record's
        // own colour at low strength.
        background: isEmoji ? 'var(--color-surface-fill)' : `color-mix(in oklab, ${fill} 14%, transparent)`,
        ...style,
      }}
    >
      {icon
        ? <PageIcon icon={icon} size={glyph} style={isEmoji ? undefined : { color: fill }} />
        : (
          // The default. Deliberately a glyph and not an empty tile: a record
          // that has not been given an icon should look UNDECORATED, not
          // BROKEN, and the two are only a few pixels apart.
          <Icon icon={fallbackIcon} size={glyph} style={{ color: fill }} />
        )}
    </span>
  );
}

/** Whether a stored icon value will render as one of the curated glyphs. */
export const isCuratedIcon = (icon?: string | null): boolean =>
  !!icon && icon.startsWith('ph:') && icon.slice(3) in PAGE_ICONS;
