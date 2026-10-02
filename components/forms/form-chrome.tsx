'use client';
// The chrome every form section shares.
//
// ── WHY THE TABS ARE NOT IN THE HEADER ROW ─────────────────────────────────
// They were, and it looked like a toolbar rather than a record: back arrow,
// title, then five tab labels, then the status badge and the verbs, all jammed
// onto one 44px line. At five sections that row has no air left, and the eye
// cannot tell "where am I" (tabs) from "what can I do" (buttons) when they are
// shoulder to shoulder at the same size.
//
// Projects had already solved this and Forms had not: a project detail is a
// title block, then a FULL-WIDTH UNDERLINE ROW of sections, then the body. The
// tab strip gets its own line and reads as navigation because it spans the
// page. That is the pattern this file now follows, so a record looks like a
// record wherever you open one.
//
// DESIGN_CONSTITUTION: "<UnderlineTabs> — detail tabs (no pill tab bars with 5+
// items)". Forms reached five sections in this sprint, which is exactly when the
// rule starts to bite.
//
// The header row above keeps what it should: where you are (back · title ·
// status) and what you can do here (the section's own verbs, hard right).
//
// NOTE: no `asChild` on Button/IconButton. The DS Button renders a loading span
// beside its label, so Radix's Slot receives two children and throws. Navigation
// goes through the router instead.
import { useRouter } from 'next/navigation';
import { ArrowLeft } from '@/components/ds/icons';
import { Badge, Icon, IconButton, type BadgeStatus } from '@/components/ds/ui';
import { PageHeader } from '@/components/ui/page-header';
import { FormTabs } from '@/components/forms/form-tabs';

const STATUS_TONE: Record<string, BadgeStatus> = { draft: 'neutral', live: 'success', closed: 'neutral' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', live: 'Live', closed: 'Closed' };

export interface FormChromeProps {
  form: {
    id: string; title: string; status: 'draft' | 'live' | 'closed';
    projectId: string | null;
  };
  responseCount?: number;
  /**
   * Right-hand actions. Each section supplies its own, because the buttons own
   * the modals they open (Preview) — lifting them here would mean lifting that
   * state too, for no gain.
   */
  actions?: React.ReactNode;
  /** Live save indicator — only Build has unsaved edits to report. */
  saving?: React.ReactNode;
  children: React.ReactNode;
}

export function FormChrome({ form, responseCount, actions, saving, children }: FormChromeProps) {
  const router = useRouter();
  const backHref = form.projectId ? `/projects/${form.projectId}` : '/forms';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        lead={
          <IconButton
            label="Back"
            variant="ghost"
            size="sm"
            icon={<Icon icon={ArrowLeft} size={16} />}
            onClick={() => router.push(backHref)}
          />
        }
        title={form.title || 'Untitled form'}
        actions={
          <>
            {saving}
            <span className="hidden sm:inline-flex"><Badge status={STATUS_TONE[form.status]}>{STATUS_LABEL[form.status]}</Badge></span>
            {actions}
          </>
        }
      />

      {/* The section strip — its own full-width line under the header, the same
          shape the project detail uses. No border or scroller of its own: the
          DS `Tabs` already brings a `border-b` and an x-ScrollArea, and wrapping
          it in a second set drew two hairlines a pixel apart. */}
      <div className="shrink-0 px-[var(--view-px)]">
        <FormTabs formId={form.id} responseCount={responseCount} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
