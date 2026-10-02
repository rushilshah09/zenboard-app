'use client';
// The line-items block — §7M's "services & prices" inside a Doc.
//
// A proposal is a Doc with special blocks (principle 8, one document system),
// so this is a block, not a page type: its rows live in the page's content JSON
// and need no table. The field names match `invoice_items` because on accept
// these rows become the invoice draft — the arithmetic itself lives in
// lib/line-items.ts so both sides compute a total the same way.
//
// The columns come from `line-items-row` / -head / -foot in ds-theme.css, which
// also carries the stacked phone layout. One grid definition, so the header,
// every row and the total stay aligned — four separate flex rows drift apart at
// some width, and a price column that does not line up with its own total is
// the one alignment bug a client will actually notice.
import { Plus, Trash2 } from '@/components/ds/icons';
import { Icon, IconButton } from '@/components/ds/ui';
import { genId } from '@/lib/blocks';
import {
  lineTotal, itemsTotal, parseAmount, money, emptyLineItem, type LineItem,
} from '@/lib/line-items';

// A table cell you type in: the ROW is the field, the grid lines are its
// boundary, so a box per cell would be six boxes inside one. Chromeless by
// construction, hence `cellProps` — see `inlineEdit` in components/ds/ui/input.
const cell =
  'w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-ui text-ink-800 outline-none ' +
  'rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1';
const cellProps = { 'data-chromeless': '' } as const;

// Only meaningful once the row stacks — above the breakpoint the columns say it.
const times = 'hidden text-meta text-ink-500 max-[560px]:inline';

export function LineItemsBlock({ items, onChange, readOnly }: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  /** The client's view (portal, print): no inputs, no controls. */
  readOnly?: boolean;
}) {
  const rows = items.length ? items : [emptyLineItem(genId())];
  const patch = (id: string, next: Partial<LineItem>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));

  return (
    <div className="my-1 overflow-hidden rounded-md border border-line-strong bg-surface-raised">
      <div className="line-items-head border-b border-line-soft px-2 py-1.5 text-overline text-ink-500">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Amount</span>
        <span aria-hidden />
      </div>

      {rows.map((r) => (
        <div key={r.id} className="group/li line-items-row border-b border-line-soft px-2 py-0.5">
          {readOnly ? (
            <span data-col="desc" className="min-w-0 px-2 py-1.5 text-ui text-ink-800 max-[560px]:pb-0">{r.description}</span>
          ) : (
            <input data-col="desc" value={r.description} onChange={(e) => patch(r.id, { description: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()} placeholder="Service or deliverable"
              aria-label="Description" autoComplete="off" data-1p-ignore className={cell} {...cellProps} />
          )}

          {/* `display: contents` above 560px — these two become their own grid
              columns. Below it the wrapper is a flex row and keeps them together. */}
          <div data-col="nums">
            {readOnly ? (
              <span className="num px-2 py-1.5 text-right text-ui text-ink-800 max-[560px]:px-0">{r.quantity}</span>
            ) : (
              // `defaultValue` + commit-on-blur: a controlled numeric input fights
              // you mid-typing ("1." is not a number), and re-parsing every
              // keystroke makes a decimal impossible to enter.
              <input defaultValue={String(r.quantity)} key={`q${r.id}`}
                onBlur={(e) => { const v = parseAmount(e.target.value, r.quantity); e.target.value = String(v); patch(r.id, { quantity: v }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onMouseDown={(e) => e.stopPropagation()} inputMode="decimal" aria-label="Quantity"
                autoComplete="off" data-1p-ignore className={`${cell} num text-right max-[560px]:w-auto max-[560px]:min-w-8 max-[560px]:px-0`} {...cellProps} />
            )}

            <span aria-hidden className={times}>×</span>

            {readOnly ? (
              <span className="num px-2 py-1.5 text-right text-ui text-ink-800 max-[560px]:px-0">{money(r.unitAmount)}</span>
            ) : (
              // Reads as money at rest, as a bare number while you edit it: a
              // rate showing "750.5" beside an amount of "$1,501" looks unfinished,
              // but "$1,200.00" is miserable to type into. `parseAmount` strips
              // the symbol and commas, so the round trip is lossless.
              <input defaultValue={money(r.unitAmount)} key={`r${r.id}`}
                onFocus={(e) => { e.target.value = String(r.unitAmount); e.target.select(); }}
                onBlur={(e) => { const v = parseAmount(e.target.value, r.unitAmount); e.target.value = money(v); patch(r.id, { unitAmount: v }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onMouseDown={(e) => e.stopPropagation()} inputMode="decimal" aria-label="Rate"
                autoComplete="off" className={`${cell} num text-right max-[560px]:w-auto max-[560px]:px-0`} data-1p-ignore {...cellProps} />
            )}
          </div>

          <span data-col="amount" className="num px-2 py-1.5 text-right text-ui tabular-nums text-ink-800">{money(lineTotal(r))}</span>

          {readOnly ? <span data-col="act" aria-hidden /> : (
            <span data-col="act" className="reveal-on-hover">
              <IconButton size="sm" variant="ghost" label={`Remove ${r.description || 'line'}`}
                icon={<Icon icon={Trash2} size={12} />}
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))} />
            </span>
          )}
        </div>
      ))}

      <div className="line-items-foot px-2 py-1.5">
        {readOnly ? <span /> : (
          <button onMouseDown={(e) => { e.preventDefault(); onChange([...rows, emptyLineItem(genId())]); }}
            className="zb-press flex cursor-pointer items-center gap-1.5 justify-self-start rounded-sm border-0 bg-transparent px-2 py-1 text-meta text-ink-500">
            <Icon icon={Plus} size={12} /> Add line
          </button>
        )}
        <span data-col="pad" aria-hidden />
        <span className="text-right text-meta font-medium text-ink-600">Total</span>
        <span className="num text-right text-ui font-semibold tabular-nums text-ink-900">{money(itemsTotal(rows))}</span>
        <span data-col="pad" aria-hidden />
      </div>
    </div>
  );
}
