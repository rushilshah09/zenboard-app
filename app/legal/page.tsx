import type { Metadata } from 'next';
import { pageMetadata, SITE_PAGES } from '@/lib/site-pages';
import Link from 'next/link';
import { ArrowRight } from '@/components/ds/icons';
import { Icon, cardInteractiveClass } from '@/components/ds/ui';
import { ContactEmail, LegalShell } from '@/components/site/legal';
import { DOCUMENTS, LEGAL } from '@/lib/legal';

// The legal centre: the documents that govern Zenboard, one line each on what they are for.

export const metadata: Metadata = pageMetadata(SITE_PAGES.legal);

export default function LegalPage() {
  return (
    <LegalShell page={SITE_PAGES.legal}
      title="The terms we work by, in plain words."
      lede={<>The agreement between you and {LEGAL.product}, what we do with your information, and the cookies this site uses.</>}
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {DOCUMENTS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className={cardInteractiveClass('group flex h-full flex-col gap-2 p-5')}
            >
              <span className="flex items-center justify-between gap-2 text-body-lg font-medium text-ink-900">
                {d.title}
                <Icon icon={ArrowRight} size={16} className="text-ink-500 transition-transform duration-fast ease-out-quiet group-hover:translate-x-0.5" />
              </span>
              <span className="text-ui text-ink-600">{d.body}</span>
              <span className="mt-auto pt-2 text-caption text-ink-500">Effective {LEGAL.effective}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-[60ch] text-body-lg text-ink-700">
        Questions about these documents, or about your information? Write to us at <ContactEmail />.
      </p>
    </LegalShell>
  );
}
