'use client';
// List ⇄ Week switch for the Tasks section. Both views show the same tasks in a
// different format — List (filterable to-do list) and Week (drag-by-day board).
// The DS SegmentedControl (§4.19) is the one view-toggle pattern app-wide; it
// drives a router push so each view still server-loads exactly the data it needs.
import { useRouter } from 'next/navigation';
import { List, LayoutGrid } from "@/components/ds/icons";
import { Icon, SegmentedControl } from '@/components/ds/ui';

export function TaskViewToggle({ view }: { view: 'list' | 'week' }) {
  const router = useRouter();
  return (
    <SegmentedControl
      aria-label="Task view"
      value={view}
      onValueChange={(v) => router.push(v === 'week' ? '/tasks?view=week' : '/tasks')}
      options={[
        { value: 'list', label: <span className="inline-flex items-center gap-1.5"><Icon icon={List} size={14} /> List</span> },
        { value: 'week', label: <span className="inline-flex items-center gap-1.5"><Icon icon={LayoutGrid} size={14} /> Week</span> },
      ]}
    />
  );
}
