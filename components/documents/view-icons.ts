// The ONE glyph per database layout, and per database entry in the slash menu.
//
// Split out for the same reason as property-icons.ts: the layout vocabulary
// (lib/collections.ts) must stay importable from a server component, and glyphs
// are React components. A layout wears the SAME picture on its view tab, in the
// view picker and in the slash menu — the user's brief, §4: "we are using the same
// icon for every database. This makes Zenboard feel generic and unfinished."
//
// The three entries that are not layouts say what they DO, in glyphs the product
// already uses for those ideas: a database (Database), full page (the PageView
// mode glyph for "Full page"), and a view of something that exists elsewhere
// (Link).
import {
  Table, Kanban, Grid2x2, Rows3, Calendar, ChartBarHorizontal, ChartBar, FileText,
  Database, ModeFullPage, Link, type IconType,
} from '@/components/ds/icons';
import { VIEW_LABEL, type ViewKind } from '@/lib/collections';
import type { BlockMenuItem } from '@/lib/blocks';

export const VIEW_ICON: Record<ViewKind, IconType> = {
  table: Table,
  board: Kanban,
  gallery: Grid2x2,
  list: Rows3,
  calendar: Calendar,
  timeline: ChartBarHorizontal,
  feed: FileText,
  chart: ChartBar,
};

type DatabaseEntry = NonNullable<BlockMenuItem['db']>;

export const DB_MENU_ICON: Record<DatabaseEntry, IconType> = {
  table: VIEW_ICON.table,
  board: VIEW_ICON.board,
  gallery: VIEW_ICON.gallery,
  list: VIEW_ICON.list,
  calendar: VIEW_ICON.calendar,
  timeline: VIEW_ICON.timeline,
  inline: Database,
  fullpage: ModeFullPage,
  linked: Link,
};

/**
 * The layouts a new view can take, in the order they are offered. Only IMPLEMENTED
 * layouts: a picker must never offer a view that renders nothing (`ViewKind` holds
 * more on purpose — chart is not built). The name and glyph are the shared ones.
 */
export const VIEW_CHOICES: { kind: ViewKind; label: string; icon: IconType }[] =
  (['table', 'board', 'gallery', 'list', 'calendar', 'timeline', 'feed'] as const)
    .map((kind) => ({ kind, label: VIEW_LABEL[kind], icon: VIEW_ICON[kind] }));
