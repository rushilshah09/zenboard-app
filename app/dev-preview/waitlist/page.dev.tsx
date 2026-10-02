'use client';
// Dev-only harness for the waitlist. 404s outside development (next.config.ts only compiles
// `.dev.tsx` when NODE_ENV=development).
//
// The SUCCESS SCREEN is the reason this exists: it only appears after a real row is written, so
// without the table (migration 0048) there is no way to look at it at all. Here it is opened with
// fixed props, which exercises everything but the two server round trips.
//
// THE ADMIN TABLE IS HERE FOR THE SAME REASON, AND ONE MORE. It sits behind a password, so looking
// at it normally means holding a credential — and what it renders is a list of real people's email
// addresses. Both of those make it a bad thing to open in order to check a column width. The rows
// below are invented, cover the cases that actually differ (a claimed handle, an unclaimed one, a
// name with a comma that would shift every later CSV column if `csvField` stopped quoting it), and
// need no secret at all.
import * as React from 'react';
import { notFound } from 'next/navigation';
import { GoldenTicket } from '@/components/site/waitlist/golden-ticket';
import { JoinedCount } from '@/components/site/waitlist/joined-count';
import { WaitlistSuccess } from '@/components/site/waitlist/waitlist-success';
import { WaitlistTable } from '@/components/admin/waitlist-table';
import type { WaitlistRow } from '@/lib/waitlist-data';

/** The shapes that differ, not a sample of the real list. */
const ROWS: WaitlistRow[] = [
  { id: 'a', number: 83, email: 'ada@example.invalid', name: 'Ada Lovelace', username: 'ada',
    username_claimed_at: '2026-09-30T09:12:00.000Z', source: 'waitlist', created_at: '2026-09-30T09:12:00.000Z' },
  // No handle: the column has to say so rather than leave a hole that reads as a rendering fault.
  { id: 'b', number: 82, email: 'grace@example.invalid', name: null, username: null,
    username_claimed_at: null, source: 'hero', created_at: '2026-09-29T17:40:00.000Z' },
  // A comma in a name. In the CSV this MUST come back quoted or every later column shifts by one.
  { id: 'c', number: 81, email: 'alan@example.invalid', name: 'Alan Turing, Jr', username: 'alan_t',
    username_claimed_at: '2026-09-28T11:05:00.000Z', source: 'footer', created_at: '2026-09-28T11:05:00.000Z' },
];

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <Harness />;
}

function Harness() {
  const [open, setOpen] = React.useState(false);
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-12 p-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-overline">The ticket</h2>
        <div className="flex flex-wrap items-start gap-8">
          <div className="w-[420px]"><GoldenTicket number={81} /></div>
          <div className="w-[240px]"><GoldenTicket number={1042} name="Rushil Shah" /></div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-overline">Already joined</h2>
        <JoinedCount joined={80} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-overline">The success screen</h2>
        <button
          type="button"
          data-open-success
          onClick={() => setOpen(true)}
          className="w-fit rounded-md border border-border px-3 py-1.5 text-body"
        >
          Open it
        </button>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-overline">The admin list</h2>
        <WaitlistTable rows={ROWS} />
      </section>

      {open && (
        <WaitlistSuccess
          number={81}
          name="Rushil Shah"
          username="rushil"
          already={false}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
