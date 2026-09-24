// Content — PRODUCT_THINKING.md §9. Every piece is a `pages` row typed
// `content`, so its script is a real document and this loader only has to add
// the pipeline (lib/content.ts).
import { userTimezone } from '@/lib/user-tz';
import { todayISO, isoDateIn } from '@/lib/date';
import { readContent, type Piece, type PieceApproval } from '@/lib/content';
import { readStageLabels } from '@/lib/stage-labels';
import { ContentWorkspace } from '@/components/content/content-workspace';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';
import { currentProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

type Row = { id: string; title: string | null; content: unknown; project_id: string | null; created_at: string };
type ApprovalRow = { id: string; page_id: string; status: PieceApproval['status']; note: string | null; created_at: string };

export default async function ContentPage() {
  const { supabase, sid } = await pageScope();

  // ONE wave; this used to be three in series. The sign-offs are asked for
  // without the pieces' ids (every approval tied to a page: RLS scopes them to
  // this person, and only a piece's own page id is ever looked up below), and
  // the projects never depended on either read.
  const [{ data }, { data: apprData }, { data: projData }] = await Promise.all([
    supabase
      .from('pages')
      .select('id, title, content, project_id, created_at')
      .eq('space_id', sid)
      .eq('type', 'content')
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    // The client's sign-off, if one was ever asked for. `approvals` is 0019 and
    // already carries `page_id` — a content piece IS a page, so the whole
    // approval loop (portal, Waiting on Home) works with nothing new added.
    // Degrades to no approvals rather than taking the page down.
    supabase.from('approvals')
      .select('id, page_id, status, note, created_at')
      .not('page_id', 'is', null)
      .order('created_at', { ascending: false }),
    // Projects a piece can be attached to — the prerequisite for asking a client
    // to sign anything off (`approvals.project_id` is NOT NULL).
    supabase.from('projects').select('id, name').eq('space_id', sid).order('name'),
  ]);
  const rows = (data as Row[] | null) ?? [];
  // A calendar date is a date in the USER's timezone, never `toISOString()`
  // (lib/date.ts) — "late" is decided against the day they are actually having,
  // and a link saved at 11pm is filed under the day it was saved on.
  const tz = await userTimezone();
  const latest = new Map<string, PieceApproval>();
  for (const a of (apprData as ApprovalRow[] | null) ?? []) {
    // Ordered newest first, so the FIRST one seen per page is the current one —
    // a re-requested approval must not be reported as its own history.
    if (latest.has(a.page_id)) continue;
    latest.set(a.page_id, { id: a.id, status: a.status, note: a.note ?? undefined, createdAt: a.created_at });
  }

  const pieces: Piece[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    meta: readContent(r.content),
    projectId: r.project_id,
    approval: latest.get(r.id),
    createdOn: isoDateIn(r.created_at, tz),
  }));

  return (
    <>
      <PageStamp />
      <ContentWorkspace
        initialPieces={pieces}
        projects={((projData as { id: string; name: string }[] | null) ?? [])}
        todayISO={todayISO(tz)}
        // What this person calls their pipeline stages (lib/stage-labels.ts),
        // from the profile row the page scope has already read: no query of its
        // own. Degrades to the default names when the preference is absent.
        stageLabels={readStageLabels((await currentProfile())?.preferences)}
      />
    </>
  );
}
