// Line items — the block that turns a Doc into a proposal (§7M).
//
// PRINCIPLE 8, ONE DOCUMENT SYSTEM: a proposal is not a new entity. It is a Doc
// containing scope blocks, a line-items block, and (next sprint) an accept
// block. That is why this ships with **no migration** — the items live in the
// page's own content JSON like every other block's payload.
//
// "Same shape as invoice items" is the plan's phrase and it is load-bearing:
// when a proposal is accepted, these rows become the invoice draft (§7M's
// crossing). So the field names match `invoice_items` — description, quantity,
// unit_amount — and the arithmetic lives here, once, rather than being written
// again on the invoice side.
import { formatMoney } from '@/lib/money';

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  /** Price per unit. Named for `invoice_items.unit_amount`, not shortened. */
  unitAmount: number;
};

/**
 * A row's own total. Rounded to cents HERE rather than at display time, because
 * a column of amounts that each round differently will not add up to the total
 * printed under them — the single most embarrassing bug a proposal can have.
 */
export const lineTotal = (i: Pick<LineItem, 'quantity' | 'unitAmount'>): number =>
  Math.round(i.quantity * i.unitAmount * 100) / 100;

/** The sum of the rows, rounded the same way so the column reconciles. */
export const itemsTotal = (items: LineItem[]): number =>
  Math.round(items.reduce((sum, i) => sum + lineTotal(i), 0) * 100) / 100;

/**
 * Money for this block. Always `exact`, unlike most of the app: a proposal is a
 * price someone is agreeing to, and "$1,200" where the figure is 1,200.50 is a
 * different number from the one they will be invoiced.
 */
export const money = (n: number): string => formatMoney(n, { exact: true });

/**
 * Parse a typed quantity or rate.
 *
 * Accepts what people actually type into a price field — "1,200", "$1,200.50",
 * " 2 " — and refuses to turn a typo into a silent zero: unparseable input
 * keeps the previous value rather than wiping the row's price.
 */
export function parseAmount(input: string, fallback: number): number {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const emptyLineItem = (id: string): LineItem =>
  ({ id, description: '', quantity: 1, unitAmount: 0 });

/** Rows worth carrying into an invoice: anything named or priced. */
export const meaningfulItems = (items: LineItem[]): LineItem[] =>
  items.filter((i) => i.description.trim() !== '' || lineTotal(i) !== 0);
