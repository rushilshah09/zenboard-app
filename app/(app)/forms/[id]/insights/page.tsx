// Form → Insights. How the form is doing, as opposed to who filled it in —
// see components/forms/insights-view.tsx for why those are two tabs.
import { notFound } from 'next/navigation';
import { loadForm, loadFormResponses } from '@/lib/forms';
import { InsightsView } from '@/components/forms/insights-view';
import { FormChrome } from '@/components/forms/form-chrome';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function FormInsightsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, responses] = await Promise.all([loadForm(id), loadFormResponses(id)]);
  if (!form) notFound();

  const complete = responses.filter((r) => r.status === 'complete').length;

  return (
    <>
      <PageStamp />
      <FormChrome form={form} responseCount={complete}>
        <InsightsView form={form} responses={responses} />
      </FormChrome>
    </>
  );
}
