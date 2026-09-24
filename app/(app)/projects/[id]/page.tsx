// Deep-link into the Projects hub with a project pre-selected.
//
// The TAB is not resolved here any more. It is a mode, so the component reads
// and writes it in the URL itself (lib/hub-url.ts) — including the legacy
// `?tab=forms` alias, which now lives beside the tab list it renames rather
// than in this one route. Resolving it in both places was how `?tab=files`
// ended up silently falling back to Overview: the route's whitelist had five
// tabs and the hub had six.
import { notFound } from 'next/navigation';
import { loadProjectsData } from '@/lib/projects-data';
import { ProjectsWorkspace } from '@/components/projects/projects-workspace';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProjectsData();
  if (!data.projects.find((p) => p.id === id)) notFound();
  return (
    <>
      <PageStamp />
      <ProjectsWorkspace {...data} initialProjectId={id} />
    </>
  );
}
