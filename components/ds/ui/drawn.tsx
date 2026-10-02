// DRAWN MARKS — the one vocabulary for pictures of Zenboard's own UI.
//
// Zenboard's illustration language is not line-art. On the website every picture is a drawn
// MINIATURE of the product — a palette, a keyboard, a digest card — built from house tokens
// and scaled as one thing (components/site/board-scenes.tsx). Inside the product the same idea
// was already alive in one private corner: the slash menu's hover previews draw "a bar of text,
// a chip, a box" in token colours. These are those marks, lifted out so every drawn picture in
// the product speaks one dialect: the slash previews, the Documents gallery's page miniatures,
// and the empty states that show a module's populated shape instead of an icon in a void.
//
// Drawn, not imported: a few token-coloured shapes follow light, dark and the Paper skin with the
// rest of the app, cost no image bytes in a worker under a 3 MiB ceiling, and stay crisp at any
// zoom. Everything here is aria-hidden by its callers — a picture of a list is not a list.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A line of text, drawn. `w` is a Tailwind width class; `style` takes a data-driven width. */
export function DrawnBar({ w = 'w-full', strong, className, style }: { w?: string; strong?: boolean; className?: string; style?: CSSProperties }) {
  return <span className={cn('block h-1.5 shrink-0 rounded-full', strong ? 'bg-ink-400' : 'bg-ink-200', w, className)} style={style} />;
}

/** A pill — a tag, a status, a small control. */
export function DrawnChip({ w = 'w-5', className }: { w?: string; className?: string }) {
  return <span className={cn('block h-2 shrink-0 rounded-full bg-ink-200', w, className)} />;
}

/** A page, drawn at glyph scale — below the DS icon scale, so not an <Icon>. */
export function DrawnPageGlyph() {
  return <span className="block h-2.5 w-2 shrink-0 rounded-[2px] border border-ink-400" />;
}

/** A tick-box, open or done. */
export function DrawnBox({ done }: { done?: boolean }) {
  return <span className={cn('block size-2 shrink-0 rounded-[2px] border', done ? 'border-ink-400 bg-ink-400' : 'border-ink-300')} />;
}

/** A list marker. */
export function DrawnDot() {
  return <span className="block size-1 shrink-0 rounded-full bg-ink-400" />;
}

/** A picture or embed — a filled block of the page's own wash. */
export function DrawnMedia({ className }: { className?: string }) {
  return <span className={cn('block h-6 w-full shrink-0 rounded-[3px] bg-ink-100', className)} />;
}

/** One line of a drawing: marks laid out left to right. */
export function DrawnRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1.5', className)}>{children}</div>;
}
