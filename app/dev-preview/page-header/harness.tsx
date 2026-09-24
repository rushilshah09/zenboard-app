'use client';
// Client half of the page-header harness. The variant arrives as a PROP from the
// server page rather than via useSearchParams — wrapping this in <Suspense> to
// satisfy that hook left the whole subtree parked in React's hidden streaming
// container (`<div hidden id="S:0">`), so the header rendered with a zero-size
// box and never reached the shell. Same trap that blanked the Settings harness.
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ViewContainer } from '@/components/ui/view-container';
import { Button, Icon, SegmentedControl } from '@/components/ds/ui';
import { Plus, Filter, ChevronLeft, ChevronRight, Repeat } from '@/components/ds/icons';

const SPACES = [{ id: 's1', name: "Rushil shah's workspace", emoji: '✦', color: '#9A1B6F', tag: 'WORK' as const }];

export function PageHeaderHarness({ v = 'plain' }: { v?: string }) {
  const header =
    v === 'lead' ? (
      <PageHeader
        title="Today"
        subtitle="2/6 done"
        lead={<>
          <Button size="sm" variant="ghost" aria-label="Previous day" icon={<Icon icon={ChevronLeft} size={16} />} />
          <Button size="sm" variant="ghost" aria-label="Next day" icon={<Icon icon={ChevronRight} size={16} />} />
        </>}
        actions={<Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />}>New habit</Button>}
      />
    ) : v === 'scope' ? (
      <PageHeader
        title="July 2026"
        subtitle="Week 31"
        actions={<>
          <SegmentedControl
            aria-label="Calendar range"
            value="week"
            options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
            onValueChange={() => {}}
          />
          <Button size="sm" variant="secondary">Today</Button>
        </>}
      />
    ) : v === 'many' ? (
      <PageHeader
        actions={<>
          <Button size="sm" variant="ghost" icon={<Icon icon={Repeat} size={14} />}>Weekly review</Button>
          <Button size="sm" variant="ghost" icon={<Icon icon={Filter} size={14} />}>Filter</Button>
          <Button size="sm" variant="secondary">Triage 12</Button>
          <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />}>New task</Button>
        </>}
      />
    ) : v === 'bare' ? (
      <PageHeader bare actions={<Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />}>New invoice</Button>} />
    ) : (
      // The common case: NO title. The app header already says "Finance".
      <PageHeader actions={<Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />}>New invoice</Button>} />
    );

  return (
    <AppShell name="Rushil shah" email="designdotrushil@gmail.com" spaces={SPACES} pins={[
      { type: 'project', id: 'p1', label: 'Balluji rebrand' },
      { type: 'doc', id: 'd1', label: 'Q3 brief' },
      { type: 'task', id: 't1', label: 'Chase the contract signature' },
      { type: 'invoice', id: 'i1', label: 'INV-018 · TechSpark' },
    ] as const} activeSpaceId="s1">
      {header}
      <ViewContainer className="pt-[var(--view-pt)] pb-[var(--view-pb)]">
        <div data-body className="rounded-lg border border-line p-6 text-ui text-ink-500">
          Body content sits in the reading column. The header above spans the whole
          panel — that contrast is what makes it read as page chrome.
        </div>
      </ViewContainer>
    </AppShell>
  );
}
