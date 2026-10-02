// THE SIDEBAR'S ROWS — derived from the one catalogue, never written twice.
//
// `lib/nav-modules.ts` owns WHAT a module is (id, label, group, description,
// whether it is core). This file adds only what a lib file cannot hold: the
// glyph and the route. The rail, the settings pane and the phone tabs all read
// from here.
//
// The table below is typed `Record<NavModuleId, …>`, so a module added to the
// catalogue without a glyph and a route is a COMPILE ERROR rather than a row
// that renders with no icon. That is the whole reason this is derived and not a
// second hand-written list: the previous arrangement had twelve rows spelled out
// in app-shell.tsx and the settings pane would have needed a thirteenth copy.
//
// Groups — MASTER_PRODUCT_PLAN §6.1: three hat-shaped groups (no section labels
// in the rail, just hairline dividers per the approved design). Route ids/hrefs
// are stable; only display labels evolve (Horizon → Goals, Money → Finance,
// Documents → Docs) so existing links, shortcuts and the palette keep working.
//
// No Inbox row: the Inbox is the Tasks rail's first view, and a nav item one
// group above it made the same list look like two different places. Capture (C)
// and "g i" both still land in it — inside Tasks, where triaging it happens.
//
// Messages sits beside Clients because that is who it is WITH (CHAT_PLAN.md);
// Content sits between the work you do FOR people and the knowledge you keep
// (PRODUCT_THINKING §9).
//
// MEMORY IS HIDDEN, NOT DELETED (user, 2026-09-07: "remove memory no need right
// now"). It is not in the catalogue, so it is in no rail and no settings list,
// while `/memory`, `components/memory/*`, `lib/memory*` and migration 0029 stay
// exactly as they are. Restoring it is one catalogue entry plus one row below.
import {
  Calendar, Target, Folder, Users, MessageCircle, Landmark, Scroll, Forms, Video,
  SquarePen, House, Flame, UnfoldHorizontal, FoldHorizontal, MousePointerClick, type IconType,
} from '@/components/ds/icons';
import { NAV_MODULES, type NavModuleId, type NavGroupId } from '@/lib/nav-modules';
import type { SidebarMode } from '@/lib/sidebar-mode';

export type NavDef = {
  id: NavModuleId;
  label: string;
  icon: IconType;
  href: string;
  group: NavGroupId;
  description: string;
  core: boolean;
  weight?: 'regular' | 'bold' | 'fill';
};

const PRESENTATION: Record<NavModuleId, { icon: IconType; href: string }> = {
  today: { icon: House, href: '/today' },
  tasks: { icon: SquarePen, href: '/tasks' },
  calendar: { icon: Calendar, href: '/calendar' },
  projects: { icon: Folder, href: '/projects' },
  clients: { icon: Users, href: '/clients' },
  messages: { icon: MessageCircle, href: '/messages' },
  forms: { icon: Forms, href: '/forms' },
  content: { icon: Video, href: '/content' },
  documents: { icon: Scroll, href: '/documents' },
  money: { icon: Landmark, href: '/money' },
  horizon: { icon: Target, href: '/horizon' },
  habits: { icon: Flame, href: '/habits' },
};

export const NAV_DEFS: NavDef[] = NAV_MODULES.map((m) => ({
  id: m.id, label: m.label, group: m.group, description: m.description, core: m.core,
  ...PRESENTATION[m.id],
}));

export const MY_DAY = NAV_DEFS.filter((d) => d.group === 'day');
export const WORK = NAV_DEFS.filter((d) => d.group === 'work');
export const HORIZON = NAV_DEFS.filter((d) => d.group === 'direction');
export const ALL = NAV_DEFS;

// Sidebar behaviour — always expanded, always collapsed, or collapsed-with-hover-
// expand (Notion-style). The popover at the rail's foot and Settings → Sidebar
// both offer exactly these three, from this one list.
export const SIDEBAR_MODES: { id: SidebarMode; label: string; icon: IconType }[] = [
  { id: 'expanded', label: 'Expanded', icon: UnfoldHorizontal },
  { id: 'collapsed', label: 'Collapsed', icon: FoldHorizontal },
  { id: 'hover', label: 'Expand on hover', icon: MousePointerClick },
];
