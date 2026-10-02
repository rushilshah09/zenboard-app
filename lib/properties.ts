// THE property vocabulary — one union, one registry, one option model.
//
// Zenboard has two places a property lives, and that is legitimate: a page has
// ONE value per property (`DocProp` in doc-properties.tsx), a database property
// is a column with a value per row (`PropDef` in lib/collections.ts). What was
// not legitimate is that the two grew separate vocabularies:
//
//   · two `PropType` unions (22 types vs 16) that disagreed about names —
//     `last_edited_time` on a page was `updated_time` in a database, the same
//     concept spelled two ways;
//   · two option models — `{ id, label, color }` vs `{ id, name, color }`;
//   · FOUR copies of the nine-colour palette (here, collections, prop-convert,
//     and lib/palette itself, which is the real one);
//   · three copies of "is this type computed / optioned";
//   · and two icon maps that disagreed, so the same property type wore a
//     different face depending on whether you met it on a page or in a table.
//
// This module is the single vocabulary. It is deliberately PURE — no icons, no
// React — so it is safe to import from a server component and cheap to test.
// The glyphs live in components/documents/property-icons.ts, keyed exhaustively
// off this union so a new type cannot be added without one.
import type { PaletteName } from '@/lib/palette';

export type PropType =
  // Structural — a database's one title column. Never user-added.
  | 'title'
  // Basic
  | 'text' | 'number' | 'select' | 'multi_select' | 'status' | 'date' | 'person'
  | 'files' | 'checkbox' | 'url' | 'email' | 'phone'
  // Advanced
  | 'formula' | 'relation' | 'rollup'
  | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by'
  | 'button' | 'place' | 'id';

export type PropGroup = 'Basic' | 'Advanced';

/** Where a type has a real editor today. A type missing from a surface would
 *  render there as a blank cell, which is worse than not being offered. */
export type PropSurface = 'page' | 'database';

/**
 * One option of a select / multi-select / status property.
 *
 * `name`, not `label` — it matches `PropDef.name` and what the database has
 * always stored. Colours are `PaletteName` from lib/palette, the app's one
 * nine-hue palette; `OptionColor` was an identical list under another name.
 */
export type PropOption = { id: string; name: string; color: PaletteName };

export type PropTypeDef = {
  type: PropType;
  label: string;
  group: PropGroup;
  surfaces: PropSurface[];
  /** Value is a set of option ids rather than a literal. */
  optioned?: boolean;
  /** The system owns the value — converting TO this type discards user data. */
  computed?: boolean;
  /** Not offered in any "add a property" list. */
  structural?: boolean;
};

const BOTH: PropSurface[] = ['page', 'database'];
const PAGE: PropSurface[] = ['page'];
/**
 * Offered NOWHERE, but still a known type.
 *
 * `propDef` resolves these, so a property already saved with one renders; they
 * are simply absent from every "add a property" list. That is the honest state
 * for a type the app understands but cannot yet honour, and it is why `surfaces`
 * exists at all — a type in the picker that renders as a text box is a promise
 * the surface does not keep, and one that renders as SOMETHING ELSE'S value is
 * worse than a promise, it is wrong data.
 */
const NONE: PropSurface[] = [];

/**
 * The registry, in picker order.
 *
 * `surfaces` records TODAY'S reality rather than an aspiration — never a count
 * repeated in prose, which is how this comment came to claim twelve and
 * twenty-two several sprints after both had moved. The numbers live in
 * lib/properties.test.ts, where a change has to be acknowledged rather than
 * merely described. Putting the difference in one column makes it a visible
 * decision instead of an invisible drift between two files, and closing a gap is
 * one word here plus the renderer, rather than a second registry.
 */
export const PROP_TYPES: PropTypeDef[] = [
  { type: 'title', label: 'Title', group: 'Basic', surfaces: ['database'], structural: true },
  { type: 'text', label: 'Text', group: 'Basic', surfaces: BOTH },
  { type: 'number', label: 'Number', group: 'Basic', surfaces: BOTH },
  { type: 'select', label: 'Select', group: 'Basic', surfaces: BOTH, optioned: true },
  { type: 'multi_select', label: 'Multi-select', group: 'Basic', surfaces: BOTH, optioned: true },
  { type: 'status', label: 'Status', group: 'Basic', surfaces: BOTH, optioned: true },
  { type: 'date', label: 'Date', group: 'Basic', surfaces: BOTH },
  { type: 'person', label: 'Person', group: 'Basic', surfaces: PAGE },
  { type: 'files', label: 'Files & media', group: 'Basic', surfaces: PAGE },   // §7H attachments
  { type: 'checkbox', label: 'Checkbox', group: 'Basic', surfaces: BOTH },
  { type: 'url', label: 'URL', group: 'Basic', surfaces: BOTH },
  { type: 'email', label: 'Email', group: 'Basic', surfaces: BOTH },
  { type: 'phone', label: 'Phone', group: 'Basic', surfaces: BOTH },
  // The engine was there all along (lib/db-engine `evalFormula`) — what was
  // missing was a caller and any way to author an expression. BOTH surfaces have
  // both now: the database renders a formula cell through the engine directly,
  // a page reaches it through lib/page-formula, and one shared FormulaEditor
  // writes the expression for either with a live result under the field.
  { type: 'formula', label: 'Formula', group: 'Advanced', surfaces: BOTH, computed: true },
  // A relation points at a RECORD — a task, a client, a project, a doc — not at
  // a row of one nominated database, which is where Notion's version starts and
  // stops. Built on the fabric: `searchRecords` for the picker, `resolveRefs`
  // for the labels, and the same `mentions` edge every internal link produces,
  // so a relation appears in Connected like any other reference.
  { type: 'relation', label: 'Relation', group: 'Advanced', surfaces: PAGE },
  // A rollup aggregates across a relation, so it cannot exist before one does.
  { type: 'rollup', label: 'Rollup', group: 'Advanced', surfaces: NONE, computed: true },
  { type: 'created_time', label: 'Created time', group: 'Advanced', surfaces: BOTH, computed: true },
  { type: 'created_by', label: 'Created by', group: 'Advanced', surfaces: PAGE, computed: true },
  { type: 'last_edited_time', label: 'Last edited time', group: 'Advanced', surfaces: BOTH, computed: true },
  { type: 'last_edited_by', label: 'Last edited by', group: 'Advanced', surfaces: PAGE, computed: true },
  // WITHDRAWN ON PURPOSE, not pending. Notion's button runs a user-defined
  // automation, and §7P is explicit that Zenboard ships named, designed
  // behaviours and "no user-defined triggers, no rule builder". A button that
  // does nothing is a worse answer than no button.
  { type: 'button', label: 'Button', group: 'Advanced', surfaces: NONE },
  { type: 'place', label: 'Place', group: 'Advanced', surfaces: PAGE },
  { type: 'id', label: 'ID', group: 'Advanced', surfaces: PAGE, computed: true },
];

const BY_TYPE = new Map(PROP_TYPES.map((d) => [d.type, d]));

/**
 * Legacy spellings, normalized on read.
 *
 * Property types are persisted inside JSON (`pages.content` for a page,
 * `collections.props` for a database), so retiring a name cannot be done by
 * editing a union — anything already saved keeps the old string. Databases
 * called the last-edited timestamp `updated_time`; pages called it
 * `last_edited_time`. The page's spelling wins because it is Notion's, and
 * because it comes with a matching `last_edited_by`.
 *
 * Same shape as `liftText` in lib/blocks.ts: tolerate the old data on the way
 * in, write the new form on the way out, and let normal editing migrate it.
 */
const ALIASES: Record<string, PropType> = {
  updated_time: 'last_edited_time',
  updated_by: 'last_edited_by',
};

export function normalizePropType(t: string | null | undefined): PropType {
  if (!t) return 'text';
  if (BY_TYPE.has(t as PropType)) return t as PropType;
  return ALIASES[t] ?? 'text';
}

/** The registry entry for a type, tolerating legacy spellings and junk. */
export const propDef = (t: string | null | undefined): PropTypeDef =>
  BY_TYPE.get(normalizePropType(t))!;

export const propLabel = (t: string | null | undefined): string => propDef(t).label;
export const isOptioned = (t: string | null | undefined): boolean => !!propDef(t).optioned;
export const isComputed = (t: string | null | undefined): boolean => !!propDef(t).computed;

/** The types a surface offers in "add a property", in picker order. */
export const propTypesFor = (surface: PropSurface): PropTypeDef[] =>
  PROP_TYPES.filter((d) => !d.structural && d.surfaces.includes(surface));

/**
 * Read an option that may still be in the page format (`label`), and give back
 * the canonical one. Options are persisted, so this is the same forward
 * migration `normalizePropType` performs for type names.
 */
export function normalizeOption(o: { id: string; name?: string; label?: string; color: PaletteName }): PropOption {
  return { id: o.id, name: o.name ?? o.label ?? '', color: o.color };
}
