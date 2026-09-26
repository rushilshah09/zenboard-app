import type { Metadata } from 'next';
import { ContactEmail, DocLink, Effective, Items, LegalShell, Part, Term, type Toc } from '@/components/site/legal';
import { CookieSettingsLink } from '@/components/site/cookie-settings-link';
import { COOKIES, LEGAL } from '@/lib/legal';

// The cookie notice: exactly the cookies and storage Zenboard sets (lib/legal.ts `COOKIES`), what
// each is for and how long it lasts, and how to change the choice. Nothing optional runs today, and
// the notice says so rather than listing categories the site does not use as though it did.

export const metadata: Metadata = {
  title: 'Cookie notice · Zenboard',
  description: 'The cookies and similar technologies Zenboard uses, what they are for, and how to change your choice.',
};

const TOC: Toc = [
  { id: 'what', title: 'What cookies are' },
  { id: 'ours', title: 'The cookies we use' },
  { id: 'optional', title: 'Optional cookies' },
  { id: 'choices', title: 'Your choices' },
  { id: 'changes', title: 'Changes to this notice' },
  { id: 'contact', title: 'Contact us' },
];

export default function CookieNoticePage() {
  const { product } = LEGAL;
  return (
    <LegalShell
      title="Cookie notice"
      lede={<>The cookies and similar technologies {product} uses, what each one is for, and how to change your choice.</>}
      toc={TOC}
    >
      <Effective />

      <Part id="what" title="What cookies are">
        <p>
          Cookies are small files a website stores in your browser so it can remember something between pages or
          visits, such as the fact that you are signed in. Local storage does the same job in a slightly different
          way. In this notice, “cookies” means both.
        </p>
      </Part>

      <Part id="ours" title="The cookies we use">
        <p>{product} uses only strictly necessary cookies: the site cannot work without them, so they do not need your consent.</p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[34rem] text-start text-ui">
            <thead>
              <tr className="border-b border-line text-ink-500">
                <th scope="col" className="px-4 py-3 text-start font-medium">Name</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Type</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">What it does</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">How long</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.name} className="border-b border-line-soft last:border-b-0 align-top">
                  <td className="px-4 py-3 font-mono text-caption text-ink-900">{c.name}</td>
                  <td className="px-4 py-3 text-ink-700">{c.kind}</td>
                  <td className="px-4 py-3 text-ink-700">{c.purpose}</td>
                  <td className="px-4 py-3 text-ink-700">{c.lasts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Part>

      <Part id="optional" title="Optional cookies">
        <p>
          We do not use analytics or marketing cookies today. If we start, they will stay off unless you allow them,
          this notice will list them, and you will be able to change your mind at any time.
        </p>
        <Items>
          <Term name="Analytics">Would help us understand how people use the site, so we can improve it.</Term>
          <Term name="Marketing">Would help us measure whether our advertising works.</Term>
        </Items>
      </Part>

      <Part id="choices" title="Your choices">
        <Items>
          <li>Change your choice at any time in <CookieSettingsLink />, which is also at the foot of every page.</li>
          <li>If your browser sends a Global Privacy Control signal, we treat it as declining every optional cookie.</li>
          <li>You can also block or delete cookies in your browser’s settings. If you block the strictly necessary ones, you will not be able to sign in.</li>
        </Items>
        <p>
          For how we handle personal information more generally, see our <DocLink href="/legal/privacy-notice">privacy notice</DocLink>.
        </p>
      </Part>

      <Part id="changes" title="Changes to this notice">
        <p>When the cookies we use change, we will update this notice and the date at the top.</p>
      </Part>

      <Part id="contact" title="Contact us">
        <p>Questions about cookies? Write to us at <ContactEmail />.</p>
      </Part>
    </LegalShell>
  );
}
