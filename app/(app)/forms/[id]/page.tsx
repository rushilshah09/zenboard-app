// The form builder. Reached from a client's or a project's Forms section —
// there is no global forms hub by design (a form always belongs to a home).
import { notFound } from 'next/navigation';
import { loadForm } from '@/lib/forms';
import { FormBuilder } from '@/components/forms/form-builder';

export const dynamic = 'force-dynamic';

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await loadForm(id);
  if (!form) notFound();

  const backHref = form.projectId ? `/projects/${form.projectId}` : '/clients';
  return <FormBuilder form={form} studio={form.studio} backHref={backHref} />;
}
