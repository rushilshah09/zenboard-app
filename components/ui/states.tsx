'use client';
// The three states every data surface must handle (PRD §14): loading, error, empty.
// One canonical implementation each — modeled on the app's best hand-rolled empty
// state (Clients) so adopting these *raises* quality everywhere, never lowers it.
import type { IconType } from '@/components/ds/icons';
import { CircleAlert } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { Button, cx } from './primitives';

// ── Skeleton ─────────────────────────────────────────────────
// Shape it like the real content, never a centered spinner.
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx('animate-pulse rounded-md bg-paper-3', className)} style={style} aria-hidden />;
}

// A stack of skeleton rows sized like list content — the default list loader.
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-paper-2 px-4 h-[52px]">
          <Skeleton className="w-4 h-4 rounded-full shrink-0" />
          <Skeleton className="h-3.5 rounded" style={{ width: `${52 + ((i * 37) % 34)}%` }} />
          <Skeleton className="ml-auto w-10 h-3.5 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────
// Specific + warm, with a primary action. Never a dead blank.
// `compact` fits inside a card/panel; default fills a full surface.
export function EmptyState({
  icon,
  title,
  hint,
  action,
  secondaryAction,
  tone = 'neutral',
  compact,
  className,
}: {
  icon?: IconType;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: { label: string; onClick: () => void; icon?: IconType };
  secondaryAction?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'accent';
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'gap-2.5 py-9 px-6' : 'gap-3 py-20 px-10', className)}>
      {icon && (
        <span className={cx('inline-grid place-items-center', tone === 'accent' ? 'text-accent-text' : 'text-ink-4')}>
          <Icon icon={icon} size={compact ? 20 : 24} />
        </span>
      )}
      <div className={cx('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
        {/* Full-surface scale matches the HiFi Inbox empty ("Capture now, plan
            later"): 24px display title over a 15px warm hint. Compact keeps the
            quieter in-card scale. */}
        <p className={cx('font-display font-medium text-ink tracking-[-0.01em]', compact ? 'text-[15px]' : 'text-[24px]')}>{title}</p>
        {hint && <p className={cx('leading-relaxed mx-auto', compact ? 'text-[13px] text-ink-4 max-w-[280px]' : 'text-[15px] text-ink-3 max-w-[320px]')}>{hint}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className={cx('flex items-center gap-2', compact ? 'mt-1' : 'mt-2')}>
          {action && (
            <Button variant="primary" size={compact ? 'sm' : 'md'} icon={action.icon} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size={compact ? 'sm' : 'md'} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── ErrorState ───────────────────────────────────────────────
// Calm message + retry. Real error logged server-side; friendly line here.
export function ErrorState({
  title = 'Something went sideways',
  hint = 'We couldn’t load this just now.',
  onRetry,
  compact,
  className,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'gap-2.5 py-9 px-6' : 'gap-3 py-14 px-10', className)}>
      <span className={cx('inline-grid place-items-center rounded-xl bg-red/10 text-red-text', compact ? 'w-11 h-11' : 'w-12 h-12')}>
        <Icon icon={CircleAlert} size={compact ? 20 : 22} />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={cx('font-display font-medium text-ink', compact ? 'text-[15px]' : 'text-[18px]')}>{title}</p>
        <p className="text-[13px] leading-relaxed text-ink-4 max-w-[280px]">{hint}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}
