'use client';
// "Noticed" — where a detected pattern is accepted or refused (§7X §4.1, M3).
//
// THIS COMPONENT IS THE NEVER-LIST MADE VISIBLE. §8 opens with "never write a
// memory silently", so every derived fact in the product passes through these
// two buttons. Nothing below writes on mount, on hover, or on a timer.
//
// It sits at the TOP of `/memory` and nowhere else. A proposal is a question,
// and a question belongs in the one place you have already come to review —
// putting it on the client page would mean being asked something every time you
// opened a record to do something else.
//
// BENCHMARK (rule 7). The nearest shipped comparisons are Gmail's "Smart
// suggestions" and Linear's "similar issues": both surface an inference inline
// and both are dismissible, but neither shows you WHY. Ours states the evidence
// on the row — "6 of 7 settled invoices, measured from the due date" — because a
// claim about your client that you cannot check is the exact thing that makes
// this kind of feature feel like surveillance. That is a deliberate difference,
// and it is the one §9's "zero surprise" measure depends on.
import { useState } from 'react';
import { Sparkles } from '@/components/ds/icons';
import { SuggestionRow, toast } from '@/components/ds/ui';
import { acceptProposal, dismissProposal, forgetMemory } from '@/lib/actions/memory';
import { BandHeading } from '@/components/memory/memory-row';
import type { ProposalView } from '@/lib/memory-suggest';

function Row({ p, onDone }: { p: ProposalView; onDone: (key: string) => void }) {
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    const res = await acceptProposal(p);
    setBusy(false);
    if ('error' in res) return toast({ message: res.error, variant: 'error' });

    const created = res.memory;
    onDone(p.key);
    toast({
      message: 'Remembered.',
      action: {
        label: 'Undo',
        // Deletes rather than archives: this row is seconds old and was never
        // meant to exist, which is the one case `forgetMemory` is for.
        onAction: () => { forgetMemory(created.id); },
      },
    });
  };

  const dismiss = async () => {
    if (busy) return;
    setBusy(true);
    const res = await dismissProposal(p.key);
    setBusy(false);
    if ('error' in res) return toast({ message: res.error, variant: 'error' });
    onDone(p.key);
    // No undo. Dismissing is already the reversible direction — nothing was
    // written, and the offer simply stops. An "undo" here would restore a
    // question, which is not a thing worth restoring.
    toast({ message: 'Won’t mention it again.' });
  };

  // The shared proposal row: the receipt is always visible, and both answers are real buttons in
  // the tab order with 44px reach on touch — an action you cannot reach without a mouse is not an
  // action.
  return (
    <SuggestionRow
      receipt={(
        <>
          {p.href ? (
            <a href={p.href} className="focus-ring rounded-sm underline decoration-line-strong underline-offset-2 hover:text-ink-800">
              {p.subjectLabel}
            </a>
          ) : p.subjectLabel}
          {' · '}{p.evidence}
        </>
      )}
      acceptLabel="Remember"
      onAccept={accept}
      dismissLabel="Don’t mention this again"
      onDismiss={dismiss}
      busy={busy}
    >
      {p.body}
    </SuggestionRow>
  );
}

export function NoticedBand({ proposals }: { proposals: ProposalView[] }) {
  const [open, setOpen] = useState(proposals);
  // Renders NOTHING when there is nothing to ask — the same rule as the panel.
  // A permanent "Noticed" heading with an empty body is chrome asking to be fed,
  // and this one would be asking about your clients.
  if (open.length === 0) return null;

  const done = (key: string) => setOpen((cur) => cur.filter((p) => p.key !== key));

  return (
    <section aria-label="Noticed" className="pb-6">
      <BandHeading icon={Sparkles} title="Noticed" count={open.length}>
        Patterns in your own data. Nothing is remembered until you say so.
      </BandHeading>
      <ul className="divide-y divide-line-soft">
        {open.map((p) => <Row key={p.key} p={p} onDone={done} />)}
      </ul>
    </section>
  );
}
