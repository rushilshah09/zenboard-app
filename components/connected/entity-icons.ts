// THE glyph and the noun for each kind of record — one map, not one per screen.
//
// Both `connected-panel` and `record-preview` carried a private, identical
// `Record<EntityType, IconType>`, and `record-preview` a `TYPE_LABEL` beside it.
// Two identical copies is the state just before a divergence: the moment a new
// entity type is added, one map gets it and the other renders `undefined`.
//
// The pinned sidebar needs exactly these two maps as well, which is what made a
// third copy the obvious next step — so they moved here instead.
//
// `Record<EntityType, …>` and not a `switch`: the exhaustive record is what makes
// adding a member to `EntityType` a COMPILE ERROR here rather than a blank icon
// discovered later.
import {
  Folder, Users, FileText, Receipt, Target, SquarePen, CalendarCheck,
  MessageCircle, MessageSquare, Forms, Brain, Video, type IconType,
} from '@/components/ds/icons';
import type { EntityType } from '@/lib/connected';

export const ENTITY_GLYPH: Record<EntityType, IconType> = {
  project: Folder,
  client: Users,
  doc: FileText,
  invoice: Receipt,
  goal: Target,
  task: SquarePen,
  meeting: CalendarCheck,
  request: MessageCircle,
  feedback: MessageSquare,
  form: Forms,
  memory: Brain,
  content: Video,
  event: CalendarCheck,
};

/** Sentence case, and the singular NOUN — "Document", not "Documents". */
export const ENTITY_LABEL: Record<EntityType, string> = {
  project: 'Project',
  client: 'Client',
  doc: 'Document',
  invoice: 'Invoice',
  goal: 'Goal',
  task: 'Task',
  meeting: 'Meeting',
  request: 'Request',
  feedback: 'Feedback',
  form: 'Form',
  memory: 'Memory',
  content: 'Content',
  event: 'Event',
};
