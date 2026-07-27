// Responses for one form — the owner's read of what came back.
import { notFound } from 'next/navigation';
import { loadForm, loadFormResponses } from '@/lib/forms';
import { ResponsesView } from '@/components/forms/responses-view';

export const dynamic = 'force-dynamic';

export default async function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, responses] = await Promise.all([loadForm(id), loadFormResponses(id)]);
  if (!form) notFound();

  const backHref = form.projectId ? `/projects/${form.projectId}` : '/clients';
  return <ResponsesView form={form} responses={responses} backHref={backHref} />;
}
