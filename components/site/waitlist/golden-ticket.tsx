// ── THE GOLDEN TICKET ───────────────────────────────────────────────────────
//
// The user's artwork (Figma, 2026-09-30: "i want this same to same"), in TWO layers — because the
// ticket is two objects and the user asked for the second one to move: "when user click on card
// [it] get out of the black box".
//
//   · `ticket-holder.svg` — the black box and its five rim strokes. 1.8 KB. Keeps the FULL export
//     box, so both layers share one coordinate space when stacked.
//   · `ticket-card.svg`   — the foil, its serrated frame, the lockup and the address. 75 KB,
//     cropped to the card's own bounds (Figma's `clip0`), so the 3D card maps the texture 1:1 onto
//     a mesh of exactly that shape.
//
// The card layer holds the name and the number, so they travel with it when it slides out — they
// are printed ON the card, not on the page.
//
// WHY <img> AND NOT INLINE SVG. Inlined, 75 KB would ride in every page that shows a ticket, once
// PER ticket, and Figma's generated ids (`paint5_linear_2_2`) would collide the moment two shared a
// page — every instance silently resolving to the first one's defs. As files they are fetched once
// and cached, and each ticket is a handful of elements.

import * as React from 'react';
import { cn } from '@/lib/cn';
import { formatTicket } from '@/lib/waitlist';
import { TicketSheen } from './ticket-sheen';

/** The two drawings, and the proportions shared with the PNG writer and the 3D card. */
export const TICKET_HOLDER = '/site/ticket-holder.svg';
export const TICKET_CARD = '/site/ticket-card.svg';
export const TICKET_RATIO = 2000 / 1296.322;        // the holder's box
/** Where the card sits inside the holder, as shares of the holder's box. */
export const CARD_INSET = { left: 0.04707, top: 0.06983, width: 0.90525, height: 0.86127 };

export function GoldenTicket({ number, name, arrive = false, out = false, bare = false, className }: {
  /** The place in the queue this ticket is for. */
  number: number;
  /** Whose ticket it is, printed top-left the way a card carries its holder. */
  name?: string | null;
  /** True when it has just been earned, so it rises in rather than simply being there. */
  arrive?: boolean;
  /** True when the card is drawn out of its holder. */
  out?: boolean;
  /** The card on its own, with no holder behind it (user, 2026-09-30: "no need black box behind
   *  card"). This is their "Only card" export — the state after someone has joined, where the
   *  ticket is the only object on the screen and an empty sleeve under it is just a hole. */
  bare?: boolean;
  className?: string;
}) {
  const label = name
    ? `Zenboard waitlist ticket for ${name}, number ${formatTicket(number)}`
    : `Zenboard waitlist ticket, number ${formatTicket(number)}`;
  return (
    <div className={cn('zb-ticket', className)} data-arrive={arrive ? 'true' : undefined} data-out={out ? 'true' : undefined} role="img" aria-label={label}>
      {!bare && <img src={TICKET_HOLDER} alt="" aria-hidden draggable={false} className="zb-ticket-holder select-none" />}
      <span aria-hidden className="zb-ticket-card">
        <img src={TICKET_CARD} alt="" aria-hidden draggable={false} className="zb-ticket-face select-none" />
        {name && <span className="zb-ticket-name">{name}</span>}
        <span className="zb-ticket-number tabular-nums">{formatTicket(number).slice(1)}</span>
        <span className="zb-ticket-sheen" />
        <TicketSheen />
      </span>
    </div>
  );
}
