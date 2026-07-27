// Deep-link into the Projects hub with a project (and optionally a tab) pre-selected.
// `?tab=portal` is what notifications point at, so the owner lands on the request
// that fired the bell rather than a generic Overview.
import { notFound } from 'next/navigation';
import { loadProjectsData } from '@/lib/projects-data';
import { ProjectsWorkspace, type DetailTab } from '@/components/projects/projects-workspace';

export const dynamic = 'force-dynamic';

const TABS: DetailTab[] = ['overview', 'tasks', 'docs', 'money', 'forms', 'portal'];

export default async function ProjectPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const data = await loadProjectsData();
  if (!data.projects.find((p) => p.id === id)) notFound();
  const initialTab = TABS.includes(tab as DetailTab) ? (tab as DetailTab) : undefined;
  return <ProjectsWorkspace {...data} initialProjectId={id} initialTab={initialTab} />;
}
