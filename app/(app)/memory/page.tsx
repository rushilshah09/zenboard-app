// Memory — the review surface (master plan §7X §7, M2). Auth via `requireUser()`
// in the loader; everything below it degrades to an honest empty state until
// migration 0029 is applied.
import { loadMemoryHome } from '@/lib/memory-data';
import { loadProposals } from '@/lib/memory-suggest';
import { MemoryHome } from '@/components/memory/memory-home';
import { requireUser } from '@/lib/auth';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ on?: string }> }) {
  // A LAYOUT IS NOT A GATE — the (app) layout's redirect cannot stop this body
  // from running, so the page gates itself like every other one here.
  await requireUser();
  const { on } = await searchParams;

  // Both in one wave. The detectors read five tables the home does not touch, so
  // running them in series would put the slower of the two on the critical path
  // for a page that is mostly hairlines and text.
  //
  // Proposals are skipped entirely when looking at a past day: a question about
  // what to remember belongs to now, and answering it from a March view would
  // write a fact dated today off a screen that says March.
  const [data, proposals] = await Promise.all([
    loadMemoryHome({ on }),
    on ? Promise.resolve([]) : loadProposals(),
  ]);
  return (
    <>
      <PageStamp />
      <MemoryHome data={data} proposals={proposals} />
    </>
  );
}
