import { cn } from '@/lib/cn';
import { optionTokens, type PropOption } from '@/lib/collections';

/**
 * An option, drawn as Notion draws it — in two shapes, because they are two kinds
 * of thing. A STATUS is a pill with a dot: a state, one step in a sequence. A
 * SELECT or multi-select option is a tag: a rounded label with no dot.
 *
 * `md` is the size a board column's header uses; everything inside a row — a
 * cell, a card, a page's property — is `sm`.
 */
export function OptionChip({ opt, status, size = 'sm', className }: {
  opt: PropOption;
  status?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = optionTokens(opt.color);
  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap font-medium',
        size === 'md' ? 'h-6 text-ui' : 'h-5 text-meta',
        status ? 'rounded-full pl-2 pr-2.5' : 'rounded-xs px-2',
        className,
      )}
      style={{ background: t.bg, color: t.text }}
    >
      {status && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: t.dot }} />}
      <span className="truncate">{opt.name}</span>
    </span>
  );
}
