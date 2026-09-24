'use client';
// "About to fade" — the last of the plan's `/memory` bands (§7X §5.4).
//
// THE PLAN SAID a memory never recalled "eventually archives itself". This band
// is the deliberate difference, and the reason is §9's measure: **zero surprise
// outranks tidiness.** A fact that vanished from a client page while you were
// not looking is exactly the failure that metric exists to catch, and a system
// that quietly loses things is worse than one that asks.
//
// So fading does two things, and only the first is automatic:
//
//   1. The fact drops in the ordering (`sortMemories` reads the FADED number),
//      which is what stops a stale claim reaching the ambient three on a record
//      page. Nothing is hidden, nothing is deleted — it just stops being the
//      thing put in front of you.
//   2. This band asks. One click keeps it for another season; one click lets it
//      go, reversibly, into the archive at the foot of this page.
//
// The three answers are the same three the weekly review asks, because it is the
// same question and a person should not have to learn it twice.
import { useState } from 'react';
// `Clock`, and not a new glyph: the icon seam is one file on purpose, and "time
// has passed" is what it already says everywhere else in this app.
import { Clock, Check } from '@/components/ds/icons';
import { Icon, toast } from '@/components/ds/ui';
import { BandHeading } from '@/components/memory/memory-row';
import { confirmMemory, archiveMemory } from '@/lib/actions/memory';
import type { Memory } from '@/lib/memory';

function Row({ m, onDone }: { m: Memory; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false);

  const keep = async () => {
    if (busy) return;
    setBusy(true);
    const res = await confirmMemory(m.id);
    setBusy(false);
    if ('error' in res) return toast({ message: res.error, variant: 'error' });
    onDone(m.id);
    toast({ message: 'Kept.' });
  };

  const letGo = async () => {
    if (busy) return;
    setBusy(true);
    const res = await archiveMemory(m.id, true);
    setBusy(false);
    if ('error' in res) return toast({ message: res.error, variant: 'error' });
    onDone(m.id);
    toast({
      message: 'Let go.',
      // Archiving is reversible by design, so the undo is real rather than a
      // courtesy — and the archive at the foot of this page is the slower path
      // to the same place.
      action: { label: 'Undo', onAction: () => { archiveMemory(m.id, false); } },
    });
  };

  return (
    <li className="group flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
      <p className="min-w-0 flex-1 text-ui text-ink-800">{m.body}</p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={keep}
          disabled={busy}
          className="focus-ring touch-row flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-caption text-ink-800 hover:bg-surface-hover disabled:opacity-50"
        >
          <Icon icon={Check} size={12} />
          Still true
        </button>
        <button
          onClick={letGo}
          disabled={busy}
          className="focus-ring touch-row flex h-8 items-center rounded-md px-2.5 text-caption text-ink-500 hover:bg-surface-hover hover:text-ink-800 disabled:opacity-50"
        >
          Let go
        </button>
      </div>
    </li>
  );
}

export function FadingBand({ facts }: { facts: Memory[] }) {
  const [open, setOpen] = useState(facts);
  // Renders nothing when nothing has gone quiet — the same rule as every other
  // band here. A permanent "About to fade" heading over an empty list would be
  // the module nagging about its own housekeeping.
  if (open.length === 0) return null;

  return (
    <section aria-label="About to fade" className="pb-6">
      <BandHeading icon={Clock} title="About to fade" count={open.length}>
        You haven’t needed these in a while. Nothing is ever deleted — letting go
        moves it to the archive below.
      </BandHeading>
      <ul className="divide-y divide-line-soft">
        {open.map((m) => (
          <Row key={m.id} m={m} onDone={(id) => setOpen((cur) => cur.filter((x) => x.id !== id))} />
        ))}
      </ul>
    </section>
  );
}
