// ── A RECORD HAS ONE FACE ───────────────────────────────────────────────────
//
// The glyph a record type wears, and the hub it falls back to when that type has no record-level
// route yet (§7J). Both are facts about the RECORD, so they belong to the record and not to
// whichever list is drawing it — the command palette, the @-mention picker and Ask all show the
// same task, and a task that is a tick in one place and a page in another is three products.
//
// This was a private `GROUPS` const inside `components/shell/command-palette.tsx`, whose own
// comment already stated the rule — *"a record has one face in this product"* — while being the
// only copy of it. Ask needed the same map, and a second copy is how a rule stated in a comment
// becomes a rule nothing enforces.
//
// WHAT IS DELIBERATELY NOT HERE: the group HEADING. That is a fact about the list, not the record
// — the palette files memories under "Recall" on purpose (§7X §5.1), and `GROUP_LABEL` in
// `lib/connected.ts` names the same type "Memory" for the Connected panel. Both are right for
// their surface, so neither belongs in a map of what a record IS.
//
// THE FALLBACK HUB stays out of `recordHref` for the reason that function documents: the Connected
// panel relies on `undefined` meaning "not addressable", so it can draw an unlinked row rather
// than a link that lands on a list. A caller that would rather land on the hub than nowhere asks
// for it here, explicitly.

import {
  Brain, Calendar, CalendarCheck, FileText, Kanban, Receipt, SquareCheck, SquarePen, Target, Users, Video,
  type IconType,
} from '@/components/ds/icons';
import type { EntityType } from '@/lib/connected';

export type RecordFace = { icon: IconType; hub: string };

/**
 * Total over `EntityType` on purpose: a new record type is a compile error here rather than a
 * missing glyph three surfaces later. The types with no record route yet still have a face, so a
 * new one lands somewhere honest instead of crashing the list that drew it.
 */
export const RECORD_FACE: Record<EntityType, RecordFace> = {
  task: { icon: SquareCheck, hub: '/tasks' },
  project: { icon: Kanban, hub: '/projects' },
  client: { icon: Users, hub: '/clients' },
  doc: { icon: FileText, hub: '/documents' },
  invoice: { icon: Receipt, hub: '/money' },
  form: { icon: SquarePen, hub: '/forms' },
  goal: { icon: Target, hub: '/horizon' },
  memory: { icon: Brain, hub: '/memory' },
  content: { icon: Video, hub: '/content' },
  event: { icon: CalendarCheck, hub: '/calendar' },
  meeting: { icon: Calendar, hub: '/calendar' },
  request: { icon: Users, hub: '/clients' },
  feedback: { icon: Users, hub: '/clients' },
};

/** The glyph for a type that arrived as a string — a search result, a URL param, a pin read from JSON. */
export const faceFor = (type: EntityType): RecordFace => RECORD_FACE[type] ?? RECORD_FACE.doc;
