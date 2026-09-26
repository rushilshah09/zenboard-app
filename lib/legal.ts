// ── THE FACTS THE LEGAL PAGES STAND ON ──────────────────────────────────────
//
// Every fact about the company that the Terms, the Privacy notice and the Cookie notice state, in
// one place, so a page can never say one thing while another says something else.
//
// Values in square brackets are NOT KNOWN YET and must be filled in before launch (the pages print
// them as they are, brackets and all, rather than print an invented address or a guessed domain).
// `legal.test.ts` lists which are still open. Have a qualified lawyer review the pages before you
// rely on them: they are careful, plain-language standard terms, not legal advice.

export const LEGAL = {
  /** The product's name, as the pages use it. */
  product: 'Zenboard',
  /** The legal entity that provides the service and is party to the Terms. */
  entity: '[Company legal name]',
  /** Where requests about personal data and legal notices go. */
  contactEmail: '[privacy contact email]',
  /** A postal address for legal notices. */
  address: '[Mailing address]',
  /** The US state whose law governs the Terms, and whose courts hear disputes. */
  governingState: '[State]',
  /** When these versions of the documents took effect. */
  effective: 'September 26, 2026',
} as const;

/** What a visitor's data passes through to make Zenboard work: the Privacy notice's service providers. */
export const PROVIDERS: { name: string; does: string }[] = [
  { name: 'Supabase', does: 'Database, sign-in and file storage.' },
  { name: 'Cloudflare', does: 'Hosting and content delivery for the app and this website.' },
  { name: 'Resend', does: 'Delivery of the emails Zenboard sends you, such as sign-in links and your morning digest.' },
  { name: 'Google', does: 'Google Calendar sync, only when you connect your calendar; and Gemini, which answers the requests you make of Zenboard’s AI features.' },
];

/** The cookies and storage Zenboard sets: the Cookie notice's table, and the cookie settings' "strictly necessary". */
export const COOKIES: { name: string; kind: 'Cookie' | 'Local storage'; purpose: string; lasts: string }[] = [
  { name: 'sb-…-auth-token', kind: 'Cookie', purpose: 'Keeps you signed in to Zenboard and your session secure.', lasts: 'Until you sign out, or up to a year' },
  { name: 'zb-consent', kind: 'Cookie', purpose: 'Remembers your cookie choice, so we do not ask again on every visit.', lasts: '1 year' },
  { name: 'zb-theme', kind: 'Local storage', purpose: 'Remembers whether you chose the light or the dark theme.', lasts: 'Until you clear it' },
];

/** The documents, in the order the Legal page lists them. */
export const DOCUMENTS = [
  { href: '/legal/terms', title: 'Terms of service', body: 'The agreement between you and us when you use Zenboard.' },
  { href: '/legal/privacy-notice', title: 'Privacy notice', body: 'What information we collect, why, who we share it with, and your rights.' },
  { href: '/legal/cookie-notice', title: 'Cookie notice', body: 'The cookies Zenboard uses, and how to change your choice.' },
] as const;

/** A value still waiting to be filled in (see the note at the top). */
export const isOpen = (v: string) => /^\[.*\]$/.test(v);
