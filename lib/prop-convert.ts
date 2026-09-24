// Changing a property's TYPE — §5.21 of the database spec.
//
// Notion's contract: attempt a coercion, and tell the user what they are about to
// lose BEFORE it happens. A silent retype that empties a column is the single most
// destructive thing a database can do to you, because it looks like it worked.
//
// Pure and dependency-free: the conversion is decided here and tested here; the
// caller owns the modal and the write.
import { nextColor, type PropDef, type PropType, type PropOption } from '@/lib/collections';
import { isOptioned, isComputed } from '@/lib/properties';

// "Optioned" and "computed" are facts about a property TYPE, not about
// conversion, so they come from the shared registry (lib/properties.ts). This
// file used to keep a third copy of both — and its COMPUTED list was already
// out of step, missing the page-only computed types entirely.
export { isOptioned, isComputed };

export type ConversionPlan = {
  /** New per-row values, keyed by row id. `undefined` means "clear this cell". */
  values: Map<string, unknown>;
  /** Options the new property needs (text → select invents them). */
  options?: PropOption[];
  /** How many rows keep a meaningful value. */
  kept: number;
  /** How many rows lose a value they had. */
  lost: number;
  /** Plain sentences for the confirm modal. Empty ⇒ nothing to warn about. */
  warnings: string[];
  /** True when every row with a value keeps it. */
  lossless: boolean;
};

type Row = { id: string; data: Record<string, unknown> };

// The app's one palette, via lib/collections' re-export. This file used to hold
// its own eight-colour list in a different order, so options INVENTED by a
// text→select conversion were coloured from a different sequence than options
// you added by hand — the same column, two colour schemes.
/** Notion caps invented options; beyond this the column is not really an enum. */
export const MAX_INVENTED_OPTIONS = 100;

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Render a stored value as the text a human would read. */
export function valueToText(v: unknown, from: PropDef): string {
  if (isEmpty(v)) return '';
  if (isOptioned(from.type)) {
    const ids = Array.isArray(v) ? (v as string[]) : [v as string];
    return ids
      .map((id) => from.options?.find((o) => o.id === id)?.name ?? '')
      .filter(Boolean)
      .join(', ');
  }
  if (from.type === 'checkbox') return v === true ? 'Yes' : 'No';
  return String(v);
}

/**
 * Plan a type change. Nothing is written — the caller shows `warnings`, and only
 * on confirmation applies `values` (and `options`, when the target needs them).
 */
export function planConversion(prop: PropDef, to: PropType, rows: Row[]): ConversionPlan {
  const from = prop.type;
  const values = new Map<string, unknown>();
  const warnings: string[] = [];
  let kept = 0;
  let lost = 0;
  const withValue = rows.filter((r) => !isEmpty(r.data[prop.id]));

  // ── Anything → computed: the new type produces its own value. ──────────────
  if (isComputed(to)) {
    for (const r of rows) values.set(r.id, undefined);
    lost = withValue.length;
    if (lost > 0) {
      warnings.push(`All ${lost} existing value${lost === 1 ? '' : 's'} will be deleted — a ${to} property computes its own value.`);
    }
    return { values, kept: 0, lost, warnings, lossless: lost === 0 };
  }

  // ── Optioned → optioned: ids are shared, so this is cheap. ─────────────────
  if (isOptioned(from) && isOptioned(to)) {
    const toSingle = to !== 'multi_select';
    for (const r of rows) {
      const v = r.data[prop.id];
      if (isEmpty(v)) { values.set(r.id, undefined); continue; }
      const ids = Array.isArray(v) ? (v as string[]) : [v as string];
      if (toSingle) {
        values.set(r.id, ids[0]);
        // Dropping extras is the ONLY loss here, and only for rows that had them.
        if (ids.length > 1) lost++; else kept++;
      } else {
        values.set(r.id, ids);
        kept++;
      }
    }
    if (lost > 0) {
      warnings.push(`${lost} row${lost === 1 ? '' : 's'} have more than one value; only the first will be kept.`);
    }
    return { values, options: prop.options, kept, lost, warnings, lossless: lost === 0 };
  }

  // ── Text-ish → optioned: invent one option per distinct value. ─────────────
  if (isOptioned(to)) {
    const seen = new Map<string, PropOption>();
    for (const r of rows) {
      const text = valueToText(r.data[prop.id], prop).trim();
      if (!text) { values.set(r.id, undefined); continue; }
      const key = text.toLowerCase();
      let opt = seen.get(key);
      if (!opt) {
        if (seen.size >= MAX_INVENTED_OPTIONS) {
          // Past the cap we stop inventing; those rows clear rather than
          // silently collapsing into a wrong option.
          values.set(r.id, undefined);
          lost++;
          continue;
        }
        opt = { id: 'o' + seen.size.toString(36) + Date.now().toString(36), name: text, color: nextColor(seen.size) };
        seen.set(key, opt);
      }
      values.set(r.id, to === 'multi_select' ? [opt.id] : opt.id);
      kept++;
    }
    const options = [...seen.values()];
    if (options.length > 0) {
      warnings.push(`${options.length} option${options.length === 1 ? '' : 's'} will be created from the existing values.`);
    }
    if (lost > 0) {
      warnings.push(`${lost} row${lost === 1 ? '' : 's'} exceed the ${MAX_INVENTED_OPTIONS}-option limit and will be cleared.`);
    }
    return { values, options, kept, lost, warnings, lossless: lost === 0 };
  }

  // ── Anything → number: parse, and clear what will not parse. ──────────────
  if (to === 'number') {
    for (const r of rows) {
      const raw = r.data[prop.id];
      if (isEmpty(raw)) { values.set(r.id, undefined); continue; }
      const text = valueToText(raw, prop).replace(/[,\s]/g, '');
      const n = Number(text);
      if (Number.isFinite(n)) { values.set(r.id, n); kept++; }
      else { values.set(r.id, undefined); lost++; }
    }
    if (lost > 0) warnings.push(`${lost} value${lost === 1 ? '' : 's'} are not numbers and will be cleared.`);
    return { values, kept, lost, warnings, lossless: lost === 0 };
  }

  // ── Anything → checkbox: only an explicit truthy word survives. ────────────
  if (to === 'checkbox') {
    for (const r of rows) {
      const text = valueToText(r.data[prop.id], prop).trim().toLowerCase();
      const on = ['yes', 'true', '1', 'checked', 'done'].includes(text);
      values.set(r.id, on);
      if (!isEmpty(r.data[prop.id])) { if (on) kept++; else lost++; }
    }
    if (lost > 0) warnings.push(`${lost} value${lost === 1 ? '' : 's'} are not yes/no and will become unchecked.`);
    return { values, kept, lost, warnings, lossless: lost === 0 };
  }

  // ── Anything → text-ish (text/url/email/phone/title/date-as-text). ─────────
  // Text is the universal sink: everything has a readable form, so nothing is
  // lost — but a date becomes a STRING, which is one-way, and that is worth
  // saying out loud because the calendar/timeline value is gone.
  for (const r of rows) {
    const text = valueToText(r.data[prop.id], prop);
    if (!text) { values.set(r.id, undefined); continue; }
    values.set(r.id, text);
    kept++;
  }
  if (from === 'date' && to !== 'date' && kept > 0) {
    warnings.push('Dates become plain text. They can no longer be sorted as dates or shown on a calendar.');
  }
  return { values, kept, lost: 0, warnings, lossless: true };
}
