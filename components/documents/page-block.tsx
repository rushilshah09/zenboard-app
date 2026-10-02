'use client';
// The Page block — a page inside the page it sits in (Notion's), drawn as the page
// itself: its icon and its name on one line, underlined like a link, the whole line
// a way in. Nothing about the page is stored on the block but its id; the name and
// icon are read from the page (lib/page-store.ts), so renaming a page renames every
// line that opens it.
//
// Pages nest without end — a page made here can hold its own pages and databases,
// whose rows are pages too (the user, 2026-09-15).
import { CircleAlert, FileText, Images } from '@/components/ds/icons';
import { Button, Icon } from '@/components/ds/ui';
import { PageIcon } from '@/components/ui/page-icon';
import { loadPage, retryPage, usePage } from '@/lib/page-store';
import { COLLECTION_PAGE_TYPE } from '@/lib/collection';

export function PageBlock({ pageId, onOpen, onRecreate }: {
  pageId?: string;
  /** Open the page — a Documents host selects it; a peek steps into it. */
  onOpen?: (pageId: string) => void;
  /** Make the page again, for a block whose page was never created. */
  onRecreate?: () => void;
}) {
  const entry = usePage(pageId);

  // A block with no page, a page the server refused to create, a page that could
  // not be read: each said where it is, with its own way back, and never in the
  // server's words (the database's rule, lib/database-failure.ts).
  if (!pageId) return <Failure title="This page was never created" onRetry={onRecreate} />;
  if (entry?.state === 'failed') {
    return entry.during === 'create'
      ? <Failure title="This page was not saved" onRetry={() => void retryPage(pageId)} />
      : <Failure title="This page could not be opened" onRetry={() => void loadPage(pageId)} />;
  }
  if (entry?.state === 'missing') {
    return (
      <p className="flex min-h-[30px] items-center gap-1.5 text-editor text-ink-500">
        <Icon icon={FileText} size={20} className="shrink-0" /> Page not found
      </p>
    );
  }

  const record = entry?.record;
  const title = record?.title?.trim();
  return (
    <button
      type="button"
      onClick={() => onOpen?.(pageId)}
      // A row, not a chip: the full width is the target, as in Notion, and the
      // underline — not a fill — is what says "this goes somewhere".
      className="focus-ring group/page flex min-h-[30px] w-full items-center gap-1.5 rounded-xs px-0.5 text-left transition-colors duration-fast hover:bg-surface-hover"
    >
      <span className="grid size-5 shrink-0 place-items-center">
        {record?.icon ? <PageIcon icon={record.icon} size={18} /> : <Icon icon={record?.type === COLLECTION_PAGE_TYPE ? Images : FileText} size={20} className="text-ink-600" />}
      </span>
      <span className={title
        ? 'min-w-0 truncate border-b border-line-strong text-editor font-medium leading-6 text-ink-900'
        : 'min-w-0 truncate border-b border-line-soft text-editor font-medium leading-6 text-ink-500'}>
        {title || 'Untitled'}
      </span>
    </button>
  );
}

function Failure({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-ui text-ink-500">
      <Icon icon={CircleAlert} size={16} className="shrink-0" />
      <span className="text-ink-800">{title}.</span>
      {onRetry && <Button variant="ghost" size="xs" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
