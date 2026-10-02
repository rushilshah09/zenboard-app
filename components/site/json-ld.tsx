import { jsonLdText } from '@/lib/structured-data';

/** Structured data for search engines, rendered into the page (lib/structured-data.ts builds it). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
