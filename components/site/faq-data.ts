// The questions people ask first, in one plain module: the page shows them (site-chrome.tsx
// `Questions`) and the homepage's structured data states them (lib/structured-data.ts `faqPage`), and
// both must say the same words, which search engines check. Plain, not 'use client', so the server
// page reads the values themselves rather than a client reference.
//
// "Who is Zenboard for?" moved with the positioning (the website and SEO plan, 2026-09-27): no longer
// only "a creative business", and still only the audiences the product serves today.

export const FAQ = [
  {
    q: 'Who is Zenboard for?',
    a: 'People who run a business and do the work in it: freelancers, founders, consultants, creators and small studios. You run your week in it, and each client gets a page of their own.',
  },
  {
    q: 'What can my clients see?',
    a: 'Only what you share: progress, approvals, documents, invoices and a conversation with you, on a private link. Your notes, hours and drafts never show, and you can turn a link off at any time.',
  },
  {
    q: 'Can I bring my work from Notion?',
    a: 'Yes. Export your pages from Notion as Markdown, then choose the files in Zenboard’s importer.',
  },
  {
    q: 'Does it work with Google Calendar?',
    a: 'Yes. Connect Google Calendar and it syncs both ways, so your meetings and your plan sit on the same day.',
  },
  {
    q: 'Can clients pay invoices online?',
    a: 'Not yet. You send the invoice, your client sees it in their portal, and you record the payment when it arrives.',
  },
  {
    q: 'How long does setting up take?',
    a: 'About two minutes: your name, your first project, and the few things you want done today.',
  },
] as const;
