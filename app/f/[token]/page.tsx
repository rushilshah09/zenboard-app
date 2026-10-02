// Public form — UNAUTHENTICATED. The token is validated server-side and only a
// fixed safe projection is returned (see lib/forms.ts). Always dynamic so a
// respondent never gets a cached copy of a form that has since changed or closed.
import { cache } from 'react';
import type { Metadata } from 'next';
import { loadFormByToken } from '@/lib/forms';
import { FormRenderer } from '@/components/forms/form-renderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ONE load per request. The loader counts a view, and the link preview's metadata
// and the page both need the form — two calls would count every visit twice.
const load = cache((token: string) => loadFormByToken(token));

/**
 * The link's preview — what a chat app or an inbox shows when the link is pasted.
 * It used to say "Form" for every form anyone ever sent; it now says what this one
 * is. Never indexed: a tokenized link is a private address.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const form = await load(token);
  const title = form?.title?.trim() || 'Form';
  const description = form?.description?.trim() || (form ? `A form from ${form.studio}.` : undefined);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const form = await load(token);

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

  // The query string as plain pairs, for pre-filled and hidden fields. Every value
  // is checked against its question in `prefillAnswers` — a URL is untrusted input.
  const pairs: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === 'string') pairs[k] = first;
  }
  const embed = pairs.embed === '1';
  // This visit's order for any shuffled question — minted HERE so the server's
  // HTML and the browser's first render agree, and the options never reorder
  // under the reader's eyes after the page loads.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];

  return (
    <main className={embed ? undefined : 'min-h-[100dvh] bg-canvas'}>
      {/* Embedded on the studio's own site, the form takes that page's ground. */}
      {embed && <style>{'html,body{background:transparent}'}</style>}
      <FormRenderer form={form} token={token} seed={seed} params={pairs} embed={embed} />
    </main>
  );
}
