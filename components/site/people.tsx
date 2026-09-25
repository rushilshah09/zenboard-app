// ── WHO IT'S FOR ────────────────────────────────────────────────────────────
//
// Three kinds of creative business, each a person at work. One row of the grid, split unevenly (the
// freelancer wide, the studio and the consultant narrow) so it reads as a page of photographs rather
// than three equal cards. The wide cell ends on the same column as every product area below it, so the
// line between them runs on down the page.
//
// The photographs illustrate who Zenboard is for. They are not customers: no names, no quotes, no
// companies. A face with a made-up testimonial is a claim the product cannot stand behind.

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Users } from '@/components/ds/icons';
import { Cell, Eyebrow, Row } from './visual';

const PEOPLE = [
  {
    src: '/site/people-freelancer.webp',
    who: 'Freelancers',
    line: 'Plan the day, keep every client close, and get paid without a spreadsheet.',
    span: 'lg:col-span-6',
    focus: 'object-[50%_30%]',
  },
  {
    src: '/site/people-studio.webp',
    who: 'Studios',
    line: 'Every project, its client and its next move, in one place.',
    span: 'lg:col-span-3',
    focus: 'object-center',
  },
  {
    src: '/site/people-consultant.webp',
    who: 'Consultants',
    line: 'Proposals, notes and invoices beside the work, and a page each client can open.',
    span: 'lg:col-span-3',
    focus: 'object-[50%_25%]',
  },
];

export function People() {
  return (
    <Row id="who" aria-labelledby="people-title">
      <Cell pad className="py-14 sm:py-16 lg:py-20">
        <div className="site-reveal grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow hue="apricot" icon={Users}>Who it’s for</Eyebrow>
            <h2 id="people-title" className="mt-6 max-w-[20ch] text-balance font-editorial text-h1 text-ink-900 sm:text-headline">
              Made for the people who run the business and do the work.
            </h2>
          </div>
          <p className="max-w-[44ch] text-body-lg text-ink-600">
            One person or a small studio, with clients to keep happy and a day that belongs to them.
          </p>
        </div>
      </Cell>
      {PEOPLE.map((p) => (
        <Cell key={p.who} className={cn('group overflow-hidden', p.span)}>
          <figure className="site-reveal flex h-full flex-col">
            <div className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in /public; there is nothing for next/image to do on this host */}
              <img
                src={p.src}
                alt=""
                width={800}
                height={1000}
                loading="lazy"
                decoding="async"
                className={cn('h-[22rem] w-full object-cover transition-transform duration-slow ease-out-quiet group-hover:scale-[1.02] sm:h-[26rem]', p.focus)}
              />
            </div>
            <figcaption className="flex-1 px-5 py-6 sm:px-6">
              <p className="text-body-lg font-medium text-ink-900">{p.who}</p>
              <p className="mt-1 max-w-[36ch] text-ui text-ink-600">{p.line}</p>
            </figcaption>
          </figure>
        </Cell>
      ))}
    </Row>
  );
}
