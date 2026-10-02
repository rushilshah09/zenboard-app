// Form → Settings. Its own route so the tab is a PLACE you can link to, not a
// mode you toggle (DESIGN_REFERENCES R1 · INTERACTION_STANDARDS §2.4).
import { notFound } from 'next/navigation';
import { loadForm, countFormResponses } from '@/lib/forms';
import { FormSettingsPage } from '@/components/forms/form-settings';
import { FormChrome } from '@/components/forms/form-chrome';
import { isField } from '@/lib/form-schema';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function FormSettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, responseCount] = await Promise.all([loadForm(id), countFormResponses(id)]);
  if (!form) notFound();

  return (
    <>
      <PageStamp />
      <FormChrome form={form} responseCount={responseCount}>
        <FormSettingsPage
          formId={form.id}
          initial={form.settings}
          status={form.status}
          questionCount={form.blocks.filter((b) => isField(b.type)).length}
          canPortal={!!form.projectId}
          inPortal={form.showInPortal}
        />
      </FormChrome>
    </>
  );
}
