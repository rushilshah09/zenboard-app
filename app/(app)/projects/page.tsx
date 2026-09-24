// Projects hub — two-pane workspace (project rail + selected-project detail).
import { loadProjectsData } from '@/lib/projects-data';
import { ProjectsWorkspace } from '@/components/projects/projects-workspace';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const data = await loadProjectsData();
  return (
    <>
      <PageStamp />
      <ProjectsWorkspace {...data} />
    </>
  );
}
