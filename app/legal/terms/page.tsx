import type { Metadata } from 'next';
import { ContactEmail, DocLink, Effective, Items, LegalShell, Part, type Toc } from '@/components/site/legal';
import { LEGAL } from '@/lib/legal';

// The terms of service. Standard, plain-language terms for a workspace product, written for this
// one: what it does today (free to use, no card payments taken, AI features, a client portal) and
// nothing it does not. Have them reviewed by a lawyer before relying on them.

export const metadata: Metadata = {
  title: 'Terms of service · Zenboard',
  description: 'The agreement between you and Zenboard when you use the Zenboard website and app.',
};

const TOC: Toc = [
  { id: 'agreement', title: 'This agreement' },
  { id: 'account', title: 'Your account' },
  { id: 'content', title: 'Your content' },
  { id: 'clients', title: 'Sharing with your clients' },
  { id: 'use', title: 'Using Zenboard responsibly' },
  { id: 'ai', title: 'AI features' },
  { id: 'third-party', title: 'Other services' },
  { id: 'price', title: 'Price' },
  { id: 'changes-service', title: 'Changes to Zenboard' },
  { id: 'ending', title: 'Ending this agreement' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limits on liability' },
  { id: 'indemnity', title: 'Indemnity' },
  { id: 'law', title: 'Governing law and disputes' },
  { id: 'changes-terms', title: 'Changes to these terms' },
  { id: 'general', title: 'General' },
  { id: 'contact', title: 'Contact us' },
];

export default function TermsPage() {
  const { product, entity, governingState } = LEGAL;
  return (
    <LegalShell
      title="Terms of service"
      lede={<>The agreement between you and {entity} when you use {product}.</>}
      toc={TOC}
    >
      <Effective />

      <Part id="agreement" title="This agreement">
        <p>
          These terms are an agreement between you and {entity} (“{product}”, “we”, “us”) for your use of the {product}
          website and app (the “service”). By creating an account or using the service, you agree to them. If you use
          {` ${product} `}for a business, you confirm that you can agree to these terms for it, and “you” includes that business.
        </p>
        <p>
          Our <DocLink href="/legal/privacy-notice">privacy notice</DocLink> explains how we handle personal information,
          and our <DocLink href="/legal/cookie-notice">cookie notice</DocLink> explains the cookies we use.
        </p>
      </Part>

      <Part id="account" title="Your account">
        <Items>
          <li>You must be at least 16 years old, and old enough to form a binding contract where you live.</li>
          <li>Give us accurate information, and keep it up to date.</li>
          <li>Keep your sign-in details secure. You are responsible for what happens under your account, and you should tell us at once if you think someone else has used it.</li>
        </Items>
      </Part>

      <Part id="content" title="Your content">
        <p>
          What you put into {product}, including tasks, documents, messages, files and the information about your
          clients (“your content”), stays yours. You give us permission to host, store, copy, process and display your
          content only as needed to run the service for you, to keep it secure, and as our privacy notice describes.
          This permission ends when you delete the content or close your account, except for copies in backups until
          they expire and anything we must keep by law.
        </p>
        <p>
          You are responsible for your content, and for having the rights and permissions it needs, including any
          consent required to add information about other people.
        </p>
      </Part>

      <Part id="clients" title="Sharing with your clients">
        <p>
          You can share parts of your workspace with others, for example through a client portal or a form. They see
          what you choose to share, and you can stop sharing at any time. You are responsible for what you share and
          with whom, and for how the people you invite use it.
        </p>
      </Part>

      <Part id="use" title="Using Zenboard responsibly">
        <p>When you use {product}, you agree not to:</p>
        <Items>
          <li>break the law, or help anyone else to;</li>
          <li>upload anything that infringes someone else’s rights, or that is harmful, fraudulent or abusive;</li>
          <li>send spam or unsolicited messages through the service;</li>
          <li>try to get into accounts or data that are not yours, or test the service’s security without our written permission;</li>
          <li>upload malware, or interfere with or overload the service;</li>
          <li>copy, resell or reverse engineer the service, except where the law allows it; or</li>
          <li>use automated means to access the service other than the ones we provide.</li>
        </Items>
      </Part>

      <Part id="ai" title="AI features">
        <p>
          Some features use artificial intelligence to draft, summarize or suggest. Their output can be wrong or
          incomplete, so check it before you rely on it or send it to anyone. You are responsible for how you use it.
        </p>
      </Part>

      <Part id="third-party" title="Other services">
        <p>
          {product} can connect to services run by others, such as Google Calendar. Your use of those services is
          governed by their own terms, and we are not responsible for them. You can disconnect them at any time.
        </p>
      </Part>

      <Part id="price" title="Price">
        <p>
          {product} is free to use today. If we introduce paid plans, we will tell you before they apply to you, and
          you will be able to choose whether to subscribe.
        </p>
      </Part>

      <Part id="changes-service" title="Changes to Zenboard">
        <p>
          We are always improving {product}, so features may change, and some may be removed. If we remove a feature
          you rely on, or stop the service altogether, we will try to give you reasonable notice and a way to export
          your content.
        </p>
      </Part>

      <Part id="ending" title="Ending this agreement">
        <p>
          You can stop using {product} and close your account at any time. We may suspend or close an account that
          breaks these terms, puts others at risk or exposes us to legal liability; where we reasonably can, we will
          tell you first and give you a chance to export your content. The parts of these terms that by their nature
          should continue, such as “Disclaimers” and “Limits on liability”, continue after the agreement ends.
        </p>
      </Part>

      <Part id="disclaimers" title="Disclaimers">
        <p>
          We work hard to keep {product} reliable, but the service is provided “as is” and “as available”. To the
          fullest extent the law allows, we make no warranties, express or implied, including warranties of
          merchantability, fitness for a particular purpose and non-infringement, and we do not promise that the
          service will be uninterrupted or error free. Keep your own copies of what matters to you.
        </p>
      </Part>

      <Part id="liability" title="Limits on liability">
        <p>
          To the fullest extent the law allows, {entity} will not be liable for any indirect, incidental, special,
          consequential or punitive damages, or for lost profits, revenue, data or goodwill, arising from your use of
          the service. Our total liability for any claim relating to the service is limited to the greater of the
          amount you paid us for the service in the twelve months before the claim arose, or one hundred US dollars.
          Some places do not allow these limits, so they may not all apply to you.
        </p>
      </Part>

      <Part id="indemnity" title="Indemnity">
        <p>
          If a claim is brought against us because of your content or because you broke these terms or the law, you
          agree to cover our reasonable costs and losses from it, to the extent the law allows.
        </p>
      </Part>

      <Part id="law" title="Governing law and disputes">
        <p>
          These terms are governed by the laws of {governingState}, USA, without regard to its conflict of laws rules.
          Any dispute that cannot be resolved informally will be decided by the state or federal courts located in
          {` ${governingState}`}, and you and we agree to their jurisdiction. If you are a consumer, nothing in these
          terms takes away the protections the law of the place where you live gives you.
        </p>
        <p>Before starting a dispute, please write to us first; most concerns can be resolved that way.</p>
      </Part>

      <Part id="changes-terms" title="Changes to these terms">
        <p>
          We may update these terms. When we do, we will change the date at the top, and if a change is significant we
          will tell you in the app or by email before it takes effect. If you keep using {product} after that, the
          updated terms apply; if you do not agree to them, you can close your account.
        </p>
      </Part>

      <Part id="general" title="General">
        <p>
          These terms, with the documents they refer to, are the whole agreement between you and us about the service.
          If a part of them cannot be enforced, the rest still applies. If we do not enforce a part of them straight
          away, we have not given up the right to. You may not transfer these terms without our consent; we may
          transfer them as part of a merger, acquisition or sale of the business.
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
