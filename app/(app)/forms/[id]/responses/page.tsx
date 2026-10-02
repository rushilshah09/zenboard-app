// Form → Responses. Who filled it in and what they said; the numbers about how
// the form is DOING live one tab over, on Insights.
import { notFound } from 'next/navigation';
import { loadForm, loadFormResponses } from '@/lib/forms';
import { ResponsesView } from '@/components/forms/responses-view';
import { FormChrome } from '@/components/forms/form-chrome';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, responses] = await Promise.all([loadForm(id), loadFormResponses(id)]);
  if (!form) notFound();

  const complete = responses.filter((r) => r.status === 'complete').length;

  // Inside the shared chrome, like every other section. This page used to build
  // its own full-height layout with its own back arrow, which meant arriving
  // here made the form's tabs vanish.
  return (
    <>
      <PageStamp />
      <FormChrome form={form} responseCount={complete}>
        <ResponsesView form={form} responses={responses} />
      </FormChrome>
    </>
  );
}
