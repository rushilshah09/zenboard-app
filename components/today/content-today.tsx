'use client';
// "Today's content" on Home — PRODUCT_THINKING §9 reaching §3.
//
// A studio's own output has to appear on the screen the day starts on. Without
// this the Content module is a place you have to REMEMBER to visit, and
// remembering where to look is the exact work Home exists to remove.
//
// It renders NOTHING when nothing is happening — same rule as "Waiting on
// others" directly above it. An empty "today's content" panel is furniture.
//
// A shoot row leads with its call TIME, because on a shoot day the only fact
// that changes what you do next is when to be there. A publish row does not:
// nothing is asked of you, it simply goes out.
import { useRouter } from 'next/navigation';
import { Video, Calendar } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { HOME_SECTION, homeRow } from '@/components/today/home-rows';
import { cn } from '@/lib/cn';
import { contentTodaySummary, type CalendarEntry } from '@/lib/content';

export function ContentToday({ entries }: { entries: CalendarEntry[] }) {
  const router = useRouter();
  if (entries.length === 0) return null;

  return (
    <section className={HOME_SECTION}>
      <Panel frame="shadow">
      <PanelHeader icon={<Icon icon={Video} size={20} />} title="Content today" summary={contentTodaySummary(entries)} />
      <PanelBody className="@container">
        {entries.map((e, i) => {
          const row = homeRow(i === entries.length - 1);
          return (
            <div key={`${e.piece.id}:${e.kind}`} className={row.outer}>
              <button
                // A shoot opens the DAY (the call sheet), a publish opens the
                // piece — the same split the calendar makes, because the same
                // reason holds: on a shoot day you need everything, not one
                // script.
                onClick={() => router.push(
                  e.kind === 'shoot'
                    ? `/content?view=calendar&shoot=${e.piece.meta.shootAt}`
                    : `/content?piece=${e.piece.id}`,
                )}
                className={cn(row.wash, 'focus-ring w-full text-left')}
              >
                {/* One ink for both glyphs: which kind it is is the glyph's SHAPE; a blue calendar beside a grey
                    camera was the only colour on the section and meant nothing. */}
                <Icon icon={e.kind === 'shoot' ? Video : Calendar} size={16} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1 truncate text-ui text-ink-800">
                  {e.piece.title?.trim() || 'Untitled'}
                </span>
                {e.kind === 'shoot' && e.piece.meta.location && (
                  <span className="shrink-0 text-caption text-ink-500 @max-md:hidden">{e.piece.meta.location}</span>
                )}
                <span className="shrink-0 text-caption tabular-nums text-ink-500">
                  {e.kind === 'shoot' ? (e.piece.meta.callTime ?? 'Shoot') : 'Goes out'}
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
