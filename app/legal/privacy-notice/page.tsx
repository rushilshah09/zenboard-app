import type { Metadata } from 'next';
import { ContactEmail, DocLink, Effective, Items, LegalShell, Part, Term, type Toc } from '@/components/site/legal';
import { LEGAL, PROVIDERS } from '@/lib/legal';

// The privacy notice. Plain language, and only what is true of the product today: every service
// named in "Who we share it with" is one the code calls (lib/legal.ts `PROVIDERS`), and nothing is
// promised that the product does not do. Have it reviewed by a lawyer before relying on it.

export const metadata: Metadata = {
  title: 'Privacy notice · Zenboard',
  description: 'What information Zenboard collects, why, who it is shared with, how long it is kept, and your rights.',
};

const TOC: Toc = [
  { id: 'about', title: 'About this notice' },
  { id: 'collect', title: 'What we collect' },
  { id: 'use', title: 'How we use it' },
  { id: 'share', title: 'Who we share it with' },
  { id: 'your-clients', title: 'Information about your clients' },
  { id: 'keep', title: 'How long we keep it' },
  { id: 'security', title: 'How we protect it' },
  { id: 'rights', title: 'Your rights and choices' },
  { id: 'us-states', title: 'US state privacy rights' },
  { id: 'eea-uk', title: 'If you are in the EEA or the UK' },
  { id: 'transfers', title: 'Where it is processed' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes to this notice' },
  { id: 'contact', title: 'Contact us' },
];

export default function PrivacyNoticePage() {
  const { product, entity } = LEGAL;
  return (
    <LegalShell
      title="Privacy notice"
      lede={<>What information {product} collects, why we collect it, who we share it with, and the choices you have.</>}
      toc={TOC}
    >
      <Effective />

      <Part id="about" title="About this notice">
        <p>
          {product} is a workspace for people who run a creative business: their day, their clients, their documents
          and their money. {product} is provided by {entity} (“{product}”, “we”, “us”). This notice explains how we
          handle personal information when you visit our website, use the {product} app, or use a page someone has
          shared with you through {product}, such as a client portal or a form.
        </p>
        <p>
          We do not sell your personal information, and we do not use the content of your workspace to train
          artificial intelligence models of our own.
        </p>
      </Part>

      <Part id="collect" title="What we collect">
        <p>We collect only what we need to run {product} for you.</p>
        <Items>
          <Term name="Account information">Your name, your email address, and the details you use to sign in. If you set a password, our sign-in provider stores it in a protected, hashed form; we never see it.</Term>
          <Term name="Settings and preferences">Your time zone, working hours, theme and the other choices you make in Settings.</Term>
          <Term name="Your content">What you put into your workspace: tasks, projects, documents, notes, messages, forms and their responses, invoices and the payments you record, and the files you upload.</Term>
          <Term name="Information about the people you work with">The names, email addresses and other details of clients and contacts that you add, and what they send through a page you share with them (see “Information about your clients” below).</Term>
          <Term name="Connected services">If you connect Google Calendar, the calendar events we read and write to keep it in sync, and the access tokens that allow it. You can disconnect it at any time.</Term>
          <Term name="Technical information">Your IP address, browser and device type, the pages and features you use, the times you use them, and error reports. We use this to keep {product} secure and working.</Term>
          <Term name="Cookies">Small files that keep you signed in and remember your choices. Our <DocLink href="/legal/cookie-notice">cookie notice</DocLink> lists them.</Term>
        </Items>
        <p>
          {product} does not process card payments today. When you record a payment, we store what you enter, not
          anyone’s card or bank details.
        </p>
      </Part>

      <Part id="use" title="How we use it">
        <Items>
          <Term name="To provide the service">To create your account, store and show your workspace, and run the features you use.</Term>
          <Term name="To keep your calendar in sync">When you have connected Google Calendar.</Term>
          <Term name="To send you email">Sign-in links, notices about your account, alerts you turn on, and your morning digest if you choose to receive it.</Term>
          <Term name="To run AI features">When you ask {product}’s AI features to do something, the content that request needs is sent to our AI provider to produce the answer, and the answer is returned to you.</Term>
          <Term name="To keep {product} safe">To protect accounts, detect abuse and misuse, and investigate problems.</Term>
          <Term name="To support you">To answer your questions and fix what goes wrong.</Term>
          <Term name="To improve {product}">To understand, in aggregate, which features are used, so we can make them better.</Term>
          <Term name="To meet our obligations">To comply with the law, and to establish or defend legal claims.</Term>
        </Items>
      </Part>

      <Part id="share" title="Who we share it with">
        <p>We share personal information only in these cases.</p>
        <Items>
          <Term name="Service providers">Companies that run parts of {product} for us, under contracts that limit what they may do with it:</Term>
        </Items>
        <ul className="flex flex-col gap-2 ps-5">
          {PROVIDERS.map((p) => (
            <li key={p.name}><span className="font-medium text-ink-900">{p.name}</span>: {p.does}</li>
          ))}
        </ul>
        <Items>
          <Term name="The people you choose">When you share a client portal, a form or a document, the people you share it with see what you chose to share.</Term>
          <Term name="For legal reasons">When the law requires it, or when it is necessary to protect the rights, property or safety of our users, the public or {product}.</Term>
          <Term name="If the business changes hands">If {product} is merged, acquired or sold, your information may move with it, and this notice will continue to apply to it.</Term>
          <Term name="With your consent">In any other case, only when you have asked us to or agreed to it.</Term>
        </Items>
        <p>We do not sell personal information, and we do not share it for targeted advertising.</p>
      </Part>

      <Part id="your-clients" title="Information about your clients">
        <p>
          When you add a client to {product}, share a portal with them, or publish a form, you decide what information
          about them goes into your workspace and why. For that information we act on your behalf, as your service
          provider: we store it and show it where you ask us to, and we do not use it for any purpose of our own.
        </p>
        <p>
          You are responsible for having the right to add it and for telling the people concerned. If one of your
          clients asks us about their information, we will pass the request to you.
        </p>
      </Part>

      <Part id="keep" title="How long we keep it">
        <p>
          We keep your information for as long as your account is open. When you delete something, it is removed from
          your workspace. When you close your account, we delete your content from our active systems, and copies held
          in backups are removed as those backups expire. We keep some records longer where the law requires it, or
          where we need them to resolve disputes or enforce our terms.
        </p>
      </Part>

      <Part id="security" title="How we protect it">
        <p>
          Information travels between your device and {product} encrypted. Access to each workspace is enforced by the
          database itself, not only by the app, and a page you share can be switched off at any time. No system is
          perfectly secure; if you find a problem, please tell us at <ContactEmail />.
        </p>
      </Part>

      <Part id="rights" title="Your rights and choices">
        <Items>
          <Term name="See, correct and export">You can see and change most of your information in the app, and export your workspace from Settings.</Term>
          <Term name="Delete">You can delete content at any time, and close your account.</Term>
          <Term name="Disconnect">You can disconnect Google Calendar and turn emails off in Settings.</Term>
          <Term name="Cookies">You can change your cookie choice from “Cookie settings” at the foot of every page.</Term>
          <Term name="Ask us">For anything you cannot do in the app, such as a copy of the information we hold about you, write to <ContactEmail />.</Term>
        </Items>
        <p>
          We will need to confirm it is you before we act on a request, and we will answer within the time the law
          allows. We will not treat you differently for using your rights.
        </p>
      </Part>

      <Part id="us-states" title="US state privacy rights">
        <p>
          Depending on where you live, including California, Colorado, Connecticut, Virginia and other states, you may
          have the right to know what personal information we collect and how we use and share it; to get a copy of
          it; to correct it; to delete it; and to opt out of its sale, its sharing for targeted advertising, and
          profiling. We do not sell personal information, share it for targeted advertising, or use it for profiling
          that has legal or similarly significant effects. We treat a Global Privacy Control signal from your browser as
          a request to opt out.
        </p>
        <p>
          You can make a request yourself or through an authorized agent. If we decline a request, you can appeal by
          replying to our answer; we will tell you the result of the appeal and how to contact your state’s attorney
          general if you disagree.
        </p>
      </Part>

      <Part id="eea-uk" title="If you are in the EEA or the UK">
        <p>
          We process your information because it is necessary to provide {product} under our terms; because it is in
          our legitimate interests to keep {product} secure and to improve it, balanced against your rights; because
          you have consented, as with optional cookies or a connected calendar, which you can withdraw at any time; or
          because the law requires it.
        </p>
        <p>
          You have the right to access, correct, delete or export your information, to object to or restrict how we
          use it, and to complain to your local data protection authority.
        </p>
      </Part>

      <Part id="transfers" title="Where it is processed">
        <p>
          We and our service providers may process your information in the United States and in other countries, which
          may have different data protection laws from yours. Where the law requires it, we rely on appropriate
          safeguards, such as the standard contractual clauses approved for these transfers.
        </p>
      </Part>

      <Part id="children" title="Children">
        <p>
          {product} is made for adults running a business. It is not directed to children under 16, and we do not
          knowingly collect their information. If you believe a child has given us information, contact us and we will
          delete it.
        </p>
      </Part>

      <Part id="changes" title="Changes to this notice">
        <p>
          When we change this notice we will update the date at the top. If a change is significant, we will tell you
          in the app or by email before it takes effect.
        </p>
      </Part>

      <Part id="contact" title="Contact us">
        <p>
          {entity}, {LEGAL.address}. Email: <ContactEmail />.
        </p>
      </Part>
    </LegalShell>
  );
}
