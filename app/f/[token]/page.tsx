// Public form — UNAUTHENTICATED. The token is validated server-side and only a
// fixed safe projection is returned (see lib/forms.ts). Always dynamic so a
// respondent never gets a cached copy of a form that has since changed or closed.
import type { Metadata } from 'next';
import { loadFormByToken } from '@/lib/forms';
import { FormRenderer } from '@/components/forms/form-renderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Form',
  robots: { index: false, follow: false }, // tokenized links are never indexed
};

export default async function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await loadFormByToken(token);

  // One calm page for every unavailable reason (unknown, unpublished, closed,
  // past its date, at its cap) — we never tell a stranger which one it was.
  if (!form) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-canvas p-6">
        <div className="max-w-[380px] text-center">
          <h1 className="font-display text-h3 text-ink-900">This form isn’t available.</h1>
          <p className="mt-2 text-body leading-relaxed text-ink-500">
            It may have been closed or the link may have changed. Please ask for an updated link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <FormRenderer form={form} token={token} />
    </main>
  );
}
