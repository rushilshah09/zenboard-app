'use client';
// THE SHEET A FORM IS FILLED IN ON — and built on.
//
// A form used to be two different drawings of the same thing. The respondent got
// a column of real fields on the page ground; the person BUILDING it got a list
// of labels with the field type written underneath in grey ("Short text ·
// Required"), which is a description of a form rather than a form (user,
// 2026-10-01: "looks default and boring, like a wireframe"). Tally's whole
// lesson is that the builder IS the published form, so you are never imagining
// what someone else will see.
//
// So both now stand on this one sheet: the studio's masthead, the title, the
// questions, the ending. The builder makes its parts editable; the renderer makes
// them answerable. Neither can drift from the other in width, rhythm or type,
// because neither spells them.
//
// The sheet is the house `sheet` (a page-sized card lying on a ground — the
// sign-up page's), not a new object. On a phone it goes edge to edge: a card
// with 16px of ground either side is a frame around nothing.
import { Mark } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

/** The form's title and description, as both sides set them. */
export const SHEET_TITLE = 'font-display text-h1 leading-tight text-ink-900';
export const SHEET_DESCRIPTION = 'whitespace-pre-wrap text-body-lg leading-relaxed text-ink-700';
/** The vertical rhythm between questions — 28px, the Field-to-Field gap of a long form. */
export const SHEET_GAP = 'gap-7';

export function studioInitials(studio: string): string {
  return studio.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** Who is asking. The respondent's first question is always "who is this from?". */
export function FormMasthead({ studio }: { studio: string }) {
  return (
    <div className="mb-10 flex items-center gap-2.5">
      {/* A wash, not a tone: on a white sheet a white tile is a well you cannot see. */}
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-fill text-meta font-semibold text-ink-800">
        {studioInitials(studio) || '·'}
      </span>
      <span className="truncate text-ui font-medium text-ink-800">{studio}</span>
    </div>
  );
}

export function PoweredBy() {
  return (
    <p className="flex items-center justify-center gap-1.5 py-6 text-meta text-ink-500">
      <Mark size={12} style={{ color: 'currentColor' }} />
      Powered by Zenboard
    </p>
  );
}

export function FormSheet({ studio, bare = false, footer = true, children, className }: {
  studio: string;
  /** Embedded on someone else's page: no card, no masthead — the host page is the frame. */
  bare?: boolean;
  footer?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[720px]', bare ? 'px-5 py-8' : 'sm:px-6 sm:pt-12')}>
      <article className={cn('relative', !bare && 'bg-paper px-5 py-9 sm:sheet sm:px-12 sm:py-12', className)}>
        {!bare && <FormMasthead studio={studio} />}
        {children}
      </article>
      {footer && <PoweredBy />}
    </div>
  );
}
