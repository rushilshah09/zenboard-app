'use client';
// The form record's section tabs — Build · Settings · Responses.
//
// These were three surfaces reached three DIFFERENT ways: Build was the page,
// Settings was a rail you toggled with a button, and Responses was a route you
// navigated away to. Same record, three grammars.
//
// INTERACTION_STANDARDS §2.4: sections of the record you're on are <Tabs>. And
// per DESIGN_REFERENCES R1, tabs are PLACES, not modes — each one is a real URL
// you can send someone, so nothing important hides behind a toggle.
import { usePathname } from 'next/navigation';
import { Tabs } from '@/components/ds/ui';
import { useNavOnce } from '@/lib/use-nav-once';

export type FormTab = 'build' | 'share' | 'insights' | 'responses' | 'settings';

/** Which tab a pathname is on. Exported so pages don't re-derive it. */
export function formTabFor(pathname: string): FormTab {
  if (pathname.endsWith('/share')) return 'share';
  if (pathname.endsWith('/insights')) return 'insights';
  if (pathname.endsWith('/settings')) return 'settings';
  if (pathname.endsWith('/responses')) return 'responses';
  return 'build';
}

export function FormTabs({ formId, responseCount }: { formId: string; responseCount?: number }) {
  const pathname = usePathname();
  const value = formTabFor(pathname);
  // Every tab click used to render the page TWICE on the server — see
  // lib/use-nav-once.ts for why, and for the log that proved it.
  const go = useNavOnce(value)

  // ORDER IS THE LIFE OF A FORM: you build it, you share it, then you read what
  // came back, and settings are the thing you touch least. Share sat in a modal
  // on the Build tab until now, which put the one thing you keep coming back for
  // behind a button on a page you had finished with.
  //
  // "Responses", not Tally's "Submissions": this app has one word for the thing
  // (`form_responses`, ResponseRecord, the hub's count) and adding a synonym for
  // one screen is how a glossary rots.
  const items = [
    { value: 'build', label: 'Build' },
    { value: 'share', label: 'Share' },
    { value: 'insights', label: 'Insights' },
    {
      value: 'responses',
      label: 'Responses',
      // The count belongs on the tab — it's the one number you want before
      // deciding whether to go there — but as the DS `count` chip, not glued
      // into the label. Glued, it was measured as part of the label and the
      // sliding underline ran under the number too.
      count: responseCount || undefined,
    },
    { value: 'settings', label: 'Settings' },
  ];

  return (
    <Tabs
      items={items}
      value={value}
      aria-label="Form sections"
      onValueChange={(v) => {
        const base = `/forms/${formId}`;
        go(v, v === 'build' ? base : `${base}/${v}`);
      }}
    />
  );
}
