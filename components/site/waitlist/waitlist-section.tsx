// ── THE WAITLIST, ON THE PAGE ───────────────────────────────────────────────
//
// The site's front door since 2026-09-30 (user: the waitlist replaces "Start free"). It lies on the
// site's own grid like every other section — the words on the left, the ticket and the form on the
// right — so the page reads as one lattice rather than a strip bolted on.
//
// A SERVER COMPONENT that asks the database how many have joined, wrapping a client form. The count
// is real: `waitlistCount()` is the seed plus the rows stored (lib/waitlist.ts explains the seed),
// and it falls back to the seed alone if the table is not there yet, so the card is never blank and
// never a lie about a number we could not read.
//
// It renders NOTHING when migration 0048 has not been applied — the page shows its ordinary call to
// action instead (site-home.tsx). A form that silently drops what people type is worse than no form.

import * as React from 'react';
import { Sparkles } from '@/components/ds/icons';
import { Cell, Eyebrow, Row } from '../visual';
import { Title } from '../words';
import { GoldenTicket } from './golden-ticket';
import { WaitlistForm } from './waitlist-form';
import { JoinedCount } from './joined-count';
import { waitlistCount } from '@/lib/waitlist-data';
import type { WaitlistSource } from '@/lib/waitlist';

export async function WaitlistSection({ source = 'site' }: { source?: WaitlistSource }) {
  const joined = await waitlistCount();
  return (
    // ONE CENTRED COLUMN ON THE PAGE'S OWN GROUND (user, 2026-09-30: "initially show only a white
    // default background with a card in the center, viewed from the top"). The card is the first
    // thing, lying flat and square to the reader — the object being offered, before anything is
    // asked of them. The black belongs to the moment AFTER they join (waitlist-success.tsx), which
    // is what makes it land: a page that is already dark has nowhere to go.
    <Row id="waitlist" aria-labelledby="waitlist-title">
      <Cell pad className="flex flex-col items-center py-20 text-center sm:py-24 lg:py-28">
        <div data-reveal-group className="flex w-full flex-col items-center">
          {/* The ticket, seen from above. It does not perform: a small parallax under the pointer
              and nothing else, because this is a thing to look at while you decide. */}
          <div data-reveal="lift" className="w-full max-w-[420px]">
<GoldenTicket number={joined + 1} />
          </div>

          <Eyebrow hue="petal" icon={Sparkles} data-reveal="rise" className="mt-10 justify-center">Early access</Eyebrow>
          <h2
            id="waitlist-title"
            data-reveal="words"
            className="mt-5 max-w-[16ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline"
          >
            <Title then="is opening slowly.">Zenboard</Title>
          </h2>
          <p data-reveal="rise" className="mt-4 max-w-[46ch] text-body-lg text-ink-600">
            We are letting people in a few at a time, so the first ones get a product that
            answers them. Join the list and we will send you a numbered ticket.
          </p>

          <div data-reveal="rise" className="mt-9 w-full max-w-[420px]">
{/* THE FORM IS ALWAYS HERE. It used to be hidden until migration 0048 was applied, which left
                the page looking unfinished and told a visitor nothing. Nobody's address is lost either
                way: if the table is missing, `joinWaitlist` says so in one plain sentence rather than
                swallowing it (lib/actions/waitlist.ts). A visible form that can explain itself beats
                a gap where the form should be. */}
            <WaitlistForm source={source} />
          </div>

          <div data-reveal="rise" className="mt-8">
            <JoinedCount joined={joined} />
          </div>
        </div>
      </Cell>
    </Row>
  );
}
