// A page's properties, evaluated by the database's formula engine.
//
// THE POINT: there is one formula language, not two. `evalFormula` already
// existed in lib/db-engine and had been running since it was written — what it
// never had was a second caller or a way to author an expression. The page's
// property system said "no expression engine yet" and withheld the type, which
// was wrong about the engine and right about the experience.
//
// The bridge is small because the shapes are genuinely close: a database keeps
// definitions in the collection and values on each row, while a page keeps both
// on one object — so a page IS a single row, and saying so in code is all the
// adapter needs to be. Nothing about the language changes, which is the whole
// reason to do it this way rather than write a second evaluator that drifts.
import { evalFormula, type FormulaValue } from '@/lib/db-engine';
import type { DbRow, PropDef } from '@/lib/collections';
import type { PropType, PropOption } from '@/lib/properties';

/** The page-side property shape this reads — narrower than `DocProp`. */
export type PageProp = {
  id: string;
  name: string;
  type: PropType;
  value?: string;
  checked?: boolean;
  options?: PropOption[];
  selected?: string[];
  fileIds?: string[];
  records?: { type: string; id: string }[];
  formula?: { expr: string };
};

export type PageContext = { pageId: string; title: string; createdAt?: string; updatedAt?: string };

/**
 * What `prop("…")` should see for one page property.
 *
 * Selects resolve to their option NAME, not the option id. A page stores ids and
 * names separately, and `prop("Stage") == "o1f3k"` is not something a person can
 * write — the name is the value as far as the author is concerned.
 *
 * A relation yields its target IDS. Names would need a database round trip, and
 * the evaluator is synchronous by design (it runs per row, per render); what
 * works today is `empty()` and comparisons against a known id, which is honest
 * and stated rather than silently half-working.
 */
function valueOf(p: PageProp): unknown {
  switch (p.type) {
    case 'checkbox': return !!p.checked;
    case 'number': {
      const n = Number((p.value ?? '').trim());
      return p.value?.trim() && Number.isFinite(n) ? n : null;
    }
    case 'select': case 'status': case 'multi_select': {
      const names = (p.selected ?? [])
        .map((id) => p.options?.find((o) => o.id === id)?.name)
        .filter((x): x is string => !!x);
      return p.type === 'multi_select' ? names : names[0] ?? null;
    }
    case 'files': return p.fileIds ?? [];
    case 'relation': return (p.records ?? []).map((r) => r.id);
    default: return p.value ?? null;
  }
}

/**
 * Project a page onto the row shape the engine reads.
 *
 * Exported for tests: the mapping is the part that can be wrong, and it is much
 * easier to argue with as data than through a rendered cell.
 */
export function pageAsRow(props: PageProp[], ctx: PageContext): { row: DbRow; defs: PropDef[] } {
  const defs: PropDef[] = props.map((p) => ({
    id: p.id, name: p.name, type: p.type,
    ...(p.options ? { options: p.options } : {}),
    ...(p.formula ? { formula: p.formula } : {}),
  }));
  const data: Record<string, unknown> = {};
  for (const p of props) data[p.id] = valueOf(p);
  return {
    defs,
    row: {
      id: ctx.pageId,
      title: ctx.title,
      data,
      created_at: ctx.createdAt ?? '',
      updated_at: ctx.updatedAt ?? '',
    } as DbRow,
  };
}

/**
 * Evaluate one page formula property. `null` for an empty or invalid
 * expression — the engine's contract, unchanged.
 */
export function evalPageFormula(prop: PageProp, props: PageProp[], ctx: PageContext): FormulaValue {
  const expr = prop.formula?.expr ?? '';
  if (!expr.trim()) return null;
  const { row, defs } = pageAsRow(props, ctx);
  return evalFormula(expr, row, defs, () => null);
}

/**
 * How a formula result reads in a property row.
 *
 * An invalid expression and one that legitimately evaluates to nothing are the
 * same `null` to the engine, so the DISTINCTION is made here, where there is a
 * person to tell: an author who mistyped needs to know, and a working formula
 * over an empty field should just be quiet.
 */
export function formulaDisplay(v: FormulaValue): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
  return v;
}
