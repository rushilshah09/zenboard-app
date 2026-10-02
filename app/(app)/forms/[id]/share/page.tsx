// Form → Share. Its own route so the link is a PLACE you can come back to,
// not a modal on a tab you had finished with
// (DESIGN_REFERENCES R1 · INTERACTION_STANDARDS §2.4).
import { notFound } from 'next/navigation';
import { loadForm, countFormResponses } from '@/lib/forms';
import { ShareView } from '@/components/forms/share-view';
import { FormChrome } from '@/components/forms/form-chrome';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function FormShareRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // In parallel, not in series. The count is for the tab bar and the form is
  // for the page; neither needs the other, and awaiting them one after the
  // other put a whole round trip (~220ms) in front of every tab click.
  const [form, responseCount] = await Promise.all([loadForm(id), countFormResponses(id)]);
  if (!form) notFound();

  return (
    <>
      <PageStamp />
      <FormChrome form={form} responseCount={responseCount}>
        <ShareView form={form} />
      </FormChrome>
    </>
  );
}
