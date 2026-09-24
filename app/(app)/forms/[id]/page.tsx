// The form builder — the default section of a form record. Reached from a
// client's or a project's Forms section, or from the global Forms hub.
import { notFound } from 'next/navigation';
import { loadForm, countFormResponses } from '@/lib/forms';
import { FormBuilder } from '@/components/forms/form-builder';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The builder draws its own `FormChrome`, because the actions in that row
  // (Preview, Publish) own state only the builder has. It still needs the tab's
  // response count — fetched beside the form, not after it.
  const [form, responseCount] = await Promise.all([loadForm(id), countFormResponses(id)]);
  if (!form) notFound();

  return (
    <>
      <PageStamp />
      <FormBuilder form={form} studio={form.studio} responseCount={responseCount} />
    </>
  );
}
