'use client';
// "Waiting on others" — the one Today question the app could not answer
// (PRODUCT_THINKING §3, §6).
//
// It is the complement of the plan above it: everything here is a thing you
// CANNOT do, sitting with somebody else. That is why it is a separate section
// rather than rows mixed into the task list — a list you act on and a list you
// chase are different jobs, and merging them makes both untrustworthy.
//
// Renders NOTHING when nothing is waiting. An empty "waiting on others" panel
// is a permanent piece of furniture on the calmest screen in the product, and
// the absence of the section is itself the answer.
import { useRouter } from 'next/navigation';
import { CheckCircle, Inbox, Receipt, type IconType } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { HOME_SECTION, homeRow } from '@/components/today/home-rows';
import { cn } from '@/lib/cn';
import { formatAgo } from '@/lib/date';
import { waitingLabel, waitingSummary, type WaitingItem, type WaitingKind } from '@/lib/waiting';

const GLYPH: Record<WaitingKind, IconType> = {
  approval: CheckCircle,
  answer: Inbox,
  payment: Receipt,
};

export function WaitingSection({ items }: { items: WaitingItem[] }) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <section className={HOME_SECTION}>
      <Panel frame="shadow">
      <PanelHeader icon={<Icon icon={Inbox} size={20} />} title="Waiting on others" summary={waitingSummary(items)} />
      {/* A container, so a row's "Awaiting payment from …" gives way before its title does on a phone. */}
      <PanelBody className="@container">
        {items.map((it, i) => {
          const row = homeRow(i === items.length - 1);
          return (
            <div key={it.id} className={row.outer}>
              <button onClick={() => router.push(it.href)} className={cn(row.wash, 'focus-ring w-full text-left')}>
                <Icon icon={GLYPH[it.kind]} size={16} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{it.title}</span>
                <span className="shrink-0 text-caption text-ink-500 @max-md:hidden">{waitingLabel(it)}</span>
                {/* How long it has sat is the number that decides whether to
                    chase — an overdue invoice says so in its own words rather
                    than in a colour a screenshot cannot carry. */}
                <span className={cn('shrink-0 text-caption tabular-nums', it.overdue ? 'text-danger-600' : 'text-ink-500')}>
                  {it.overdue ? 'Overdue' : formatAgo(it.since, { precise: true }) ?? ''}
                </span>
              </button>
            </div>
          );
        })}
      </PanelBody>
      </Panel>
    </section>
  );
}
