'use client';
// The accept block — §7M's "typed-name acceptance + timestamp + IP", the moment
// a proposal stops being a document and becomes an agreement.
//
// ONE COMPONENT, THREE AUDIENCES: the owner writing the terms, the client
// signing them, and both of them afterwards reading what was signed. They are
// the same block, so they are one component — a separate portal copy would drift
// the wording between what the owner previewed and what the client agreed to,
// which is the one place in the product where drift is not a cosmetic problem.
//
// What this component deliberately does NOT hold is the signature itself. It
// takes an `Acceptance` and renders it; producing one is a server round trip
// every time (lib/actions/acceptance.ts). See lib/acceptance.ts for why.
import { useRef, useState } from 'react';
import { Check, PenTool, Receipt, TriangleAlert } from '@/components/ds/icons';
import { Button, Icon, Link, TextInput } from '@/components/ds/ui';
import { formatDayTime } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import {
  acceptStatement, acceptLabel, acceptanceStatus, validateSignerName,
  STATEMENT_MAX, NAME_MAX, type AcceptTerms, type Acceptance,
} from '@/lib/acceptance';

export type AcceptBlockProps = {
  terms?: AcceptTerms;
  /** Present in the editor: the owner is authoring the terms. */
  onChange?: (terms: AcceptTerms) => void;
  /** The signature, if there is one. */
  acceptance?: Acceptance | null;
  /** Fingerprints of the document as it stands now (`acceptanceStatus`) — drive the "edited" note. */
  currentHashes?: readonly string[];
  /** Present in the portal: this viewer can actually sign. */
  onAccept?: (name: string, email: string) => Promise<{ error: string } | { ok: true }>;
  /** Present in the editor once signed: withdraw the record. */
  onWithdraw?: () => void;
  /**
   * The invoice §7M's crossing drafted from this proposal, if any. Owner side
   * only — the portal never shows a client the studio's invoicing.
   */
  invoice?: { id: string; number: string; status: string } | null;
  /** Re-run the crossing. Absent before 0035, so the line simply isn't there. */
  onCreateInvoice?: () => void;
};

const shell = 'my-1 rounded-md border border-line-strong bg-surface-raised px-4 py-3.5';

export function AcceptBlock({ terms, onChange, acceptance, currentHashes, onAccept, onWithdraw, invoice, onCreateInvoice }: AcceptBlockProps) {
  const status = acceptanceStatus(acceptance, currentHashes);
  if (acceptance && status !== 'awaiting') {
    return (
      <Signed acceptance={acceptance} edited={status === 'edited'} onWithdraw={onWithdraw}
        invoice={invoice} onCreateInvoice={onCreateInvoice} />
    );
  }
  return <Unsigned terms={terms} onChange={onChange} onAccept={onAccept} />;
}

// ── Before ───────────────────────────────────────────────────────────────────

function Unsigned({ terms, onChange, onAccept }: Pick<AcceptBlockProps, 'terms' | 'onChange' | 'onAccept'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const statement = acceptStatement(terms);
  const label = acceptLabel(terms);
  const canSign = !!onAccept;
  const wantsEmail = !!terms?.requireEmail;

  async function submit() {
    if (!onAccept || busy) return;
    const checked = validateSignerName(name);
    if ('error' in checked) { setError(checked.error); return; }
    setBusy(true);
    setError(null);
    const res = await onAccept(checked.name, email.trim());
    setBusy(false);
    if ('error' in res) setError(res.error);
  }

  return (
    <div className={shell}>
      {onChange ? (
        // Edited in place and styled identically to the read-only line, so the
        // owner is looking at the client's view while writing it — Notion's rule
        // that a block never has a separate "edit mode" appearance.
        <AutoTextarea
          value={statement}
          onChange={(v) => onChange({ ...terms, statement: v })}
          aria-label="What the client agrees to"
          maxLength={STATEMENT_MAX}
        />
      ) : (
        <p className="m-0 text-ui leading-normal text-ink-800">{statement}</p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-52">
          <span className="mb-1 block text-overline text-ink-500">Full name</span>
          <TextInput
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Type your name"
            maxLength={NAME_MAX}
            autoComplete="name"
            disabled={!canSign}
            aria-invalid={!!error}
          />
        </label>

        {wantsEmail && (
          <label className="min-w-0 flex-1 basis-52">
            <span className="mb-1 block text-overline text-ink-500">Email</span>
            <TextInput
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
              onMouseDown={(e) => e.stopPropagation()}
              type="email" placeholder="you@company.com" autoComplete="email"
              disabled={!canSign}
            />
          </label>
        )}

        <Button
          variant="primary"
          onClick={() => void submit()}
          // The owner does not sign their own proposal. Disabled rather than
          // hidden so the editor shows the button the client will see.
          //
          // It is NOT disabled for a missing name any more. A disabled primary
          // renders as a pale wash (the DS gives every disabled button
          // `bg-surface-disabled` + `ink-300` — measured 1.74:1 in light and
          // 1.20:1 in dark on this card), so to a client who has not typed yet
          // the one action on the page reads as absent. Pressing it runs the
          // same `validateSignerName` a typed name does and says what is
          // missing out loud (the role="alert" line below). WCAG exempts
          // disabled controls from contrast, which is why this had to be found
          // by looking rather than by a contrast pass.
          disabled={!canSign || busy}
          icon={<Icon icon={PenTool} size={14} />}
        >
          {busy ? 'Recording…' : label}
        </Button>
      </div>

      {error && <p role="alert" className="mt-2 mb-0 text-meta text-danger">{error}</p>}

      {/* One line, not two. It has to answer why the button is dead (the client
          signs, not you), what the record is worth, and what it is NOT — and a
          stack of grey captions under a form is the thing nobody reads. */}
      {onChange && (
        <p className="mt-2.5 mb-0 text-meta leading-normal text-ink-500">
          Your client signs this from the portal. Their name, the time and their address are
          recorded, which is enough to show agreement but not a qualified e-signature.
        </p>
      )}
    </div>
  );
}

// ── After ────────────────────────────────────────────────────────────────────

function Signed({ acceptance, edited, onWithdraw, invoice, onCreateInvoice }: {
  acceptance: Acceptance; edited: boolean; onWithdraw?: () => void;
  invoice?: { id: string; number: string; status: string } | null;
  onCreateInvoice?: () => void;
}) {
  const when = formatDayTime(acceptance.acceptedAt, { year: true });
  return (
    <div className={shell}>
      <div className="flex items-start gap-2.5">
        <Icon icon={Check} size={20} className="mt-0.5 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-ui font-medium text-ink-900">
            Accepted by {acceptance.signerName}
            {acceptance.amount !== null && <> · {formatMoney(acceptance.amount, { exact: true })}</>}
          </p>
          <p className="mt-0.5 mb-0 text-meta text-ink-500">
            {when}
            {acceptance.signerEmail && <> · {acceptance.signerEmail}</>}
          </p>
        </div>
        {onWithdraw && (
          <Button variant="ghost" size="sm" onClick={onWithdraw}>Withdraw</Button>
        )}
      </div>

      {/* The exact words that were agreed to — not the block's current text, which
          may since have been rewritten. This is the whole point of storing them. */}
      <p className="mt-2.5 mb-0 border-l-2 border-line-strong pl-3 text-meta leading-normal text-ink-600">
        {acceptance.statement}
      </p>

      {/* §7P provenance: the behaviour says what it did, on the object it did it
          to. Without this the invoice appears in Finance with no explanation of
          where it came from, which is how an automation stops being trusted. */}
      {(invoice || onCreateInvoice) && (
        <p className="mt-2.5 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-500">
          {invoice ? (
            <>
              <Icon icon={Receipt} size={12} className="shrink-0" />
              <span>Invoice</span>
              <Link href={`/money/${invoice.id}`} className="font-medium text-ink-800">{invoice.number}</Link>
              <span>· {invoice.status}</span>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onCreateInvoice} icon={<Icon icon={Receipt} size={12} />}>
              Create invoice draft
            </Button>
          )}
        </p>
      )}

      {edited && (
        <p className="mt-2.5 mb-0 flex items-start gap-1.5 text-meta text-warning">
          <Icon icon={TriangleAlert} size={12} className="mt-0.5 shrink-0" />
          This document has been edited since it was accepted. The wording above is what was agreed.
        </p>
      )}
    </div>
  );
}

// ── ──────────────────────────────────────────────────────────────────────────

/** A textarea that is the height of its text — no scrollbar inside a document. */
function AutoTextarea({ value, onChange, maxLength, ...rest }: {
  value: string; onChange: (v: string) => void; maxLength?: number;
} & React.AriaAttributes) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <textarea data-chromeless
      ref={(el) => { ref.current = el; fit(el); }}
      value={value}
      onChange={(e) => { onChange(e.target.value); fit(e.target); }}
      onMouseDown={(e) => e.stopPropagation()}
      maxLength={maxLength}
      rows={1}
      className="m-0 block w-full resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 text-ui leading-normal text-ink-800 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      {...rest}
    />
  );
}
