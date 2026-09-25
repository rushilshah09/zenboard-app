'use client';
// App shell — Figma HIfi frame (nodes 467:2295 / 476:13435): floating panels on
// canvas with 4px gutters — 230px paper sidebar (logo header · nav groups split
// by elements-1 hairlines · Projects group label · sidebar control · workspace
// foot) beside a 44px header panel and a paper-3 content panel. Active nav =
// warm selected wash + 2×25 berry edge bar. Below 820px the sidebar becomes a
// drawer and a bottom tab bar appears.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TaskDetailDrawer } from '@/components/task-detail/task-detail-drawer';
import { RealtimeSync } from '@/components/shell/realtime-sync';
import { MutationWorker } from '@/components/shell/mutation-worker';
import { ActionFailureNet } from '@/components/shell/action-failure-net';
import { TimezoneSync } from '@/components/shell/timezone-sync';
import { ReminderScheduler } from '@/components/reminders/reminder-scheduler';
import { NotificationsBell } from '@/components/shell/notifications-bell';
import { CommandPalette } from '@/components/shell/command-palette';
import { GlobalShortcuts } from '@/components/shell/keyboard-shortcuts';
import { QuickCapture } from '@/components/shell/quick-capture';
import { NewSpaceModal } from '@/components/shell/new-space-modal';
import { setActiveSpace } from '@/lib/actions/spaces';
import { isFocusMode, FOCUS_PATH, FOCUS_EXIT_PATH } from '@/lib/focus-mode';
import { ViewWidthProvider } from '@/components/shell/view-width';
import { ThemeToggleItem } from '@/components/shell/theme-toggle';
import { SwitchTrack } from '@/components/ui/switch-track';
import { initTaskSound } from '@/lib/sound';
import {
  DEFAULT_SIDEBAR_MODE, SIDEBAR_KEY, SIDEBAR_SESSION_KEY,
  isSidebarMode, writeSidebarCookie, type SidebarMode,
} from '@/lib/sidebar-mode';
import { useNarrow } from '@/lib/use-narrow';
import * as RDlg from '@radix-ui/react-dialog';
import { RAIL_MOTION, railFade } from '@/components/shell/rail-motion';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Target, Folder, Users, MessageCircle, Landmark, Scroll, Forms, Video, Search, ChevronDown, ChevronRight, Plus, Settings, LogOut, Keyboard, SquarePen, House, Flame, PanelLeft, List, Power, Timer, UnfoldHorizontal, FoldHorizontal, MousePointerClick, Circle, type IconType } from "@/components/ds/icons";
import { Icon, Logo, Button, IconButton, Tooltip, Toaster, CONTENT_PANE_SURFACE } from "@/components/ds/ui";
import { FocusEdge } from '@/components/shell/focus-edge';
import { BootSplash } from '@/components/shell/boot-splash';
import { navigateWithTransition } from '@/lib/view-transition';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ds/ui/dropdown-menu";
import { FocusTimer } from '@/components/focus/focus-timer';
import { PinnedRail } from '@/components/shell/pinned-rail';
import type { Pin } from '@/lib/pins';
import { createClient } from '@/lib/supabase/client';
import { useChanged } from "@/lib/use-changed";

type SpaceLite = { id: string; name: string; emoji: string | null; color: string; tag: string | null };
type NavDef = { id: string; label: string; icon: IconType; href: string; weight?: 'regular' | 'bold' | 'fill' };

// Sidebar behaviour — always expanded, always collapsed, or collapsed-with-hover-
// expand (Notion-style). The "Sidebar control" popover manages two independent
// states (DS v2 spec): the CURRENT mode (row click, immediate, temporary) and the
// DEFAULT STARTUP mode (right-hand radio indicator, persisted, restored on every
// launch). Current lives in sessionStorage (per-tab, survives in-tab reloads);
// default lives in a COOKIE so the server can render it — see lib/sidebar-mode.ts.
const SIDEBAR_MODES: { id: SidebarMode; label: string; icon: IconType }[] = [
  { id: 'expanded', label: 'Expanded', icon: UnfoldHorizontal },
  { id: 'collapsed', label: 'Collapsed', icon: FoldHorizontal },
  { id: 'hover', label: 'Expand on hover', icon: MousePointerClick },
];
// The mode vocabulary lives in lib/sidebar-mode.ts so the SERVER layout can read
// it too — see the note there for why a cookie and not just localStorage.

// Nav groups — MASTER_PRODUCT_PLAN §6.1: three hat-shaped groups (no section
// labels, just hairline dividers per the approved design). Route ids/hrefs are
// stable; only display labels evolve (Horizon → Goals, Money → Finance,
// Documents → Docs) so existing links, shortcuts and the palette keep working.
// No Inbox row: the Inbox is the Tasks rail's first view, and a nav item one
// group above it made the same list look like two different places. Capture (C)
// and "g i" both still land in it — inside Tasks, where triaging it happens.
const MY_DAY: NavDef[] = [
  { id: 'today', label: 'Home', icon: House, href: '/today' },
  { id: 'tasks', label: 'Tasks', icon: SquarePen, href: '/tasks' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
];
const WORK: NavDef[] = [
  { id: 'projects', label: 'Projects', icon: Folder, href: '/projects' },
  { id: 'clients', label: 'Clients', icon: Users, href: '/clients' },
  // Beside Clients because that is who it is WITH: a conversation per project, shared with the
  // client through its portal (CHAT_PLAN.md).
  { id: 'messages', label: 'Messages', icon: MessageCircle, href: '/messages' },
  { id: 'forms', label: 'Forms', icon: Forms, href: '/forms' },
  // Content sits between the work you do FOR people and the knowledge you keep:
  // it is the studio's own output, and PRODUCT_THINKING §9 is explicit that an
  // agency's own content is not a second tool.
  { id: 'content', label: 'Content', icon: Video, href: '/content' },
  { id: 'documents', label: 'Docs', icon: Scroll, href: '/documents' },
  { id: 'money', label: 'Finance', icon: Landmark, href: '/money' },
];
// Goals (where you are going) · Habits (what you repeat).
//
// MEMORY IS HIDDEN, NOT DELETED (user, 2026-09-07: "remove memory no need right
// now"). The row below is the ONE place the module was reachable from, so
// commenting it out takes Memory off the product surface while `/memory`, the
// `components/memory/*` module, `lib/memory*` and the applied 0029 migration all
// stay exactly as they are. Restoring it is this one line plus `Brain` back
// in the icon import above.
const HORIZON: NavDef[] = [
  { id: 'horizon', label: 'Goals', icon: Target, href: '/horizon' },
  { id: 'habits', label: 'Habits', icon: Flame, href: '/habits' },
  // { id: 'memory', label: 'Memory', icon: Brain, href: '/memory' },
];
const ALL = [...MY_DAY, ...WORK, ...HORIZON];

const useIsMobile = () => useNarrow(820);

// THE nav row — one geometry, one selected state, for every row in the sidebar.
//
// The module rows and the project rows underneath them had the SAME 12-property
// style object written out twice, which is how a list and the list below it end
// up disagreeing about what "selected" looks like. One function now answers it
// for both, so a change to the selected state cannot reach one and miss the other.
function navRowStyle(active: boolean, collapsed?: boolean): React.CSSProperties {
  return {
    position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--nav-gap, 8px)', height: 'var(--row-nav, 32px)',
    // ONE geometry in both states (components/shell/rail-motion.ts). The row
    // stretches to its column, so in the 50px rail it is the 32px square by
    // construction (no `34`, no literal width), and only its inset changes,
    // gliding with the panel instead of the row re-centring on frame 0.
    flexShrink: 0,
    padding: collapsed ? '0 var(--nav-rail-px, 6px)' : '0 var(--nav-px, 8px)', justifyContent: 'flex-start',
    // ONE radius, both states. It was 6 at rest and 8 when selected, so the
    // row changed shape as you moved through the list.
    borderRadius: 'var(--r-sm, 6px)', textDecoration: 'none',
    background: active ? 'var(--color-surface-selected)' : undefined,
    color: active ? 'var(--color-ink-900)' : 'var(--color-text-secondary)',
    fontSize: 14, lineHeight: 1, fontWeight: active ? 500 : 400,
    transition: `padding ${RAIL_MOTION}, background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover)`,
  };
}

// THE selected-nav icon weight. Selected rows render the FILLED cut of the same
// Phosphor glyph; everything else renders the outline.
//
// The state used to be carried entirely by the wash behind the row plus a 500
// label — which is legible on the row you are looking at and invisible in
// peripheral vision, because an outline glyph has the same ink mass whether or
// not it is selected. The fill changes the glyph's weight rather than its shape,
// so the row still reads as the same icon in the same family; it is Phosphor's
// own mechanism for exactly this, not a second icon set.
//
// This supersedes the seam's older "never fill a nav-row glyph" rule (user
// directive, 2026-09-07) — see components/ds/icons.ts, where the rule lives.
const navWeight = (active: boolean): NonNullable<NavDef['weight']> => (active ? 'fill' : 'regular');

function NavItem({ def, active, onClick, collapsed }: { def: NavDef; active: boolean; onClick?: () => void; collapsed?: boolean }) {
  return (
    <Link
      href={def.href}
      onClick={onClick}
      title={collapsed ? def.label : undefined}
      aria-label={collapsed ? def.label : undefined}
      aria-current={active ? 'page' : undefined}
      className="zb-nav-item"
      style={navRowStyle(active, collapsed)}
    >
      {/* B&G active nav (Figma 1:696): neutral white-8% wash, radius 8, ink-900
          medium label, and the glyph's filled cut. No colored edge bar. */}
      <Icon icon={def.icon} size={20} weight={def.weight ?? navWeight(active)} style={{ flexShrink: 0, color: 'currentColor' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...railFade(collapsed) }}>{def.label}</span>
    </Link>
  );
}

// Group separator — spans the full sidebar width (negative margin cancels the
// nav's horizontal padding), so it runs edge to edge with no side gaps.
function NavDivider() {
  return <div aria-hidden style={{ height: 1, background: 'var(--color-elements-1)', flexShrink: 0, margin: '4px calc(-1 * var(--nav-inset, 8px))' }} />;
}

// The sidebar mode picker.
//
// ── ONE CONTROL PER ROW (2026-09-08, user: "remove this radio button") ──────
// Each row used to carry TWO controls: the row itself switched the sidebar, and
// a 16px circle on the right marked that mode as the startup default. The circle
// looked exactly like a selection radio for the row it sat in, so it read as a
// duplicate of the highlight — which is what the user saw and why they asked for
// it to go.
//
// It was worse than duplication. The row's own switch was TEMPORARY (per-tab
// sessionStorage), so choosing "Collapsed" and opening a new tab gave you an
// expanded sidebar again, and the only way to make a choice stick was a circle
// whose purpose appeared solely in a hover tooltip. Two controls, one obvious
// and wrong, one correct and hidden.
//
// Now: picking a mode PERSISTS it. One control, one meaning, and the behaviour a
// user already expects. It also removes a nested interactive control from inside
// a `menuitemradio`, which was never a legal thing to build.
//
// The menu itself is Radix through the DS wrapper — the last hand-positioned
// portal in the shell. Losing the second control is what made that a clean swap:
// every row is now exactly one `DropdownMenuRadioItem`.
function SidebarControl({ mode, onModeChange, collapsed }: {
  mode: SidebarMode;
  onModeChange: (m: SidebarMode) => void;
  collapsed: boolean;
}) {
  return (
    <div style={{ padding: '6px var(--nav-inset, 8px) 0', display: 'flex' }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Sidebar control"
            title="Sidebar control"
            className="zb-nav-item"
            // The nav row's geometry in both states: it stretches to the column and
            // only its inset glides (components/shell/rail-motion.ts).
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--nav-gap, 8px)', height: 'var(--row-nav)', width: '100%', padding: collapsed ? '0 var(--nav-rail-px, 6px)' : '0 var(--nav-px, 8px)', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', overflow: 'hidden', transition: `padding ${RAIL_MOTION}, background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)` }}
          >
            <Icon icon={PanelLeft} size={20} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1, color: 'var(--color-text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap', ...railFade(collapsed) }}>Sidebar control</span>
            <Icon icon={ChevronRight} size={20} style={{ color: 'var(--color-icon-quiet)', flexShrink: 0, ...railFade(collapsed) }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-[230px]">
          <DropdownMenuLabel>Sidebar control</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode} onValueChange={(v) => onModeChange(v as SidebarMode)}>
            {SIDEBAR_MODES.map((o) => (
              <DropdownMenuRadioItem key={o.id} value={o.id}>
                <Icon icon={o.icon} size={16} />
                <span className="flex-1 truncate">{o.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Sidebar({ name, email, spaces, pins, current, activeSpaceId, onNavigate, mode, onModeChange, collapsed, floating }: {
  name: string; email: string; spaces: SpaceLite[]; pins: Pin[]; current: string; activeSpaceId?: string; onNavigate?: () => void; mode?: SidebarMode; onModeChange?: (m: SidebarMode) => void; collapsed?: boolean; floating?: boolean;
}) {
  const [activeId, setActiveId] = useState(activeSpaceId ?? spaces[0]?.id);
  const [newSpace, setNewSpace] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignout, setConfirmSignout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const space = spaces.find((s) => s.id === activeId) ?? spaces[0];

  if (useChanged(activeSpaceId) && activeSpaceId) setActiveId(activeSpaceId);

  function pickSpace(id: string) { setActiveId(id); setMenuOpen(false); setActiveSpace(id).then(() => router.refresh()); }
  async function signOut() { await createClient().auth.signOut(); router.push('/login'); router.refresh(); }

  const avatar = (space?.emoji && space.emoji.trim()) || name.slice(0, 2).toUpperCase();

  return (
    <div style={{
      width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', minWidth: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      height: '100%', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 'var(--r-lg)',
      boxShadow: floating ? 'var(--shadow-lg)' : 'var(--shadow-xs)', transition: `width ${RAIL_MOTION}, min-width ${RAIL_MOTION}, box-shadow var(--duration-fast) var(--ease-hover)`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Brand header (Figma 476:13437): 48px row, p-8, logo left · collapse
          button right; collapsed rail centers the mark. Border-b elements-1. */}
      <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
        {/* The brand is ONE element in both states, so it cannot jump: the lockup's
            mark sits where the rail's mark sits (a 2px glide, 4px in to 6px) and only
            the wordmark fades. Collapsed, the same element is the Expand button;
            expanded, it is decoration, out of the Tab order and the pointer's way. */}
        <button
          type="button"
          onClick={collapsed ? () => onModeChange?.('expanded') : undefined}
          aria-label={collapsed ? 'Expand sidebar' : undefined}
          title={collapsed ? 'Expand sidebar' : undefined}
          aria-hidden={collapsed ? undefined : true}
          tabIndex={collapsed ? undefined : -1}
          className="zb-press"
          style={{ width: collapsed ? 'var(--row-nav)' : 'auto', height: 'var(--row-nav)', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 0, overflow: 'visible', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: collapsed ? 'pointer' : 'default', pointerEvents: collapsed ? undefined : 'none' }}
        >
          <Logo height={20} style={{ color: 'var(--ink)', marginLeft: collapsed ? 6 : 4, transition: `margin-left ${RAIL_MOTION}` }} wordmarkStyle={railFade(collapsed)} />
        </button>
        {onModeChange && (
          <button onClick={() => onModeChange('collapsed')} aria-label="Collapse sidebar" title="Collapse sidebar" className="zb-nav-item"
            tabIndex={collapsed ? -1 : undefined} aria-hidden={collapsed || undefined}
            style={{ marginLeft: 'auto', flexShrink: 0, width: 32, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'var(--color-icon-default)', pointerEvents: collapsed ? 'none' : undefined, ...railFade(collapsed, 'background var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)') }}>
            <Icon icon={PanelLeft} size={16} weight="regular" />
          </button>
        )}
      </div>
      <div aria-hidden style={{ height: 1, background: 'var(--color-elements-1)', flexShrink: 0 }} />

      {/* Nav */}
      <nav style={{ padding: 'var(--nav-inset, 8px)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 'var(--nav-row-gap, 2px)', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {MY_DAY.map((m) => <NavItem key={m.id} def={m} active={current === m.id} onClick={onNavigate} collapsed={collapsed} />)}
        <NavDivider />
        {WORK.map((m) => <NavItem key={m.id} def={m} active={current === m.id} onClick={onNavigate} collapsed={collapsed} />)}
        <NavDivider />
        {HORIZON.map((m) => <NavItem key={m.id} def={m} active={current === m.id} onClick={onNavigate} collapsed={collapsed} />)}
        {/* PINNED — was a hard-coded list of active projects. A project is not a
            special kind of record: what belongs one click away is whatever you
            are living in, which is as often a brief or an invoice. The rail
            pins any `EntityType`, reorders by drag, and scrolls
            (components/shell/pinned-rail.tsx). */}
        {pins.length > 0 && <>
          <NavDivider />
          <PinnedRail pins={pins} collapsed={collapsed} onNavigate={onNavigate} />
        </>}
      </nav>

      {/* Foot — sidebar control (collapse) + workspace / account switcher.
          Dividers span the full sidebar width (foot has no horizontal padding). */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }} ref={menuRef}>
        {onModeChange && (
          <SidebarControl mode={mode ?? 'expanded'} onModeChange={onModeChange} collapsed={!!collapsed} />
        )}
        {/* Workspace foot (Figma 476:13477): border-t elements-1 · p-8 · inner
            row p-4 rounded-6 · 24px paper-5 avatar · 14px name · 18px caret. */}
        {/* Workspace foot (Figma 476:13477): border-t elements-1 · p-8 · inner
            row p-4 rounded-6 · 24px paper-5 avatar · 14px name · 18px caret.
            The menu is Radix `DropdownMenu` through the DS wrapper. It used to
            be a hand-positioned portal, and the cost of that was measured, not
            assumed: Escape did nothing, focus never left <body> when the menu
            opened, and ArrowDown did nothing — the account menu, one of the
            most-used controls in the shell, could not be operated by keyboard
            at all. Radix brings dismissal, focus capture and restore, roving
            arrows, typeahead, and collision-aware placement; the DS wrapper
            shares MENU_PANEL_CLASS / MENU_ITEM_CLASS verbatim, so the chrome is
            unchanged. Portalling (which the hand-rolled version needed so the
            collapsed rail's `overflow: hidden` could not clip it) is built in. */}
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(o) => { setMenuOpen(o); if (!o) setConfirmSignout(false); }}
        >
          {/* One button in both states: the avatar sits 13px in either way, so only
              the name and the caret fade (components/shell/rail-motion.ts). */}
          <div style={{ borderTop: '1px solid var(--color-elements-1)', marginTop: 8, padding: 8, display: 'flex' }}>
            <DropdownMenuTrigger asChild>
              <button aria-label={collapsed ? name : undefined} title={collapsed ? name : undefined} className="zb-nav-item" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 6, background: menuOpen ? 'var(--hover)' : 'transparent', border: 'none', cursor: 'pointer', width: '100%', overflow: 'hidden' }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--color-paper-5)', color: 'var(--color-ink-700)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 400, flexShrink: 0 }}>{[...avatar][0]}</div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 400, color: 'var(--color-ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', ...railFade(collapsed) }} title={email}>{name}&apos;s workspace</span>
                <Icon icon={ChevronDown} size={20} style={{ color: 'var(--color-icon-quiet)', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', ...railFade(collapsed, 'transform var(--duration-base) var(--ease-standard)') }} />
              </button>
            </DropdownMenuTrigger>
          </div>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={6}
            aria-label="Workspace and account"
            className="overflow-hidden"
            style={{ width: collapsed ? 248 : 'max(var(--radix-dropdown-menu-trigger-width), 220px)', maxWidth: 'none' }}
          >
            {confirmSignout ? (
              <div style={{ padding: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-body-lg-size)', fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>Sign out?</div>
                <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginBottom: 12 }}>You&apos;ll need to log in again to get back in.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="danger" size="sm" className="flex-1" onClick={signOut}>Sign out</Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirmSignout(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  {spaces.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      active={s.id === activeId}
                      onSelect={() => pickSpace(s.id)}
                      icon={<div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 'var(--r-sm)', background: s.color, color: 'var(--on-accent)', display: 'grid', placeItems: 'center', fontSize: 'var(--text-label-size)' }}>{s.emoji}</div>}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onSelect={() => setNewSpace(true)}
                    icon={<div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 'var(--r-sm)', border: '1px dashed var(--line)', display: 'grid', placeItems: 'center' }}><Icon icon={Plus} size={12} /></div>}
                  >
                    New workspace
                  </DropdownMenuItem>
                </div>
                {/* The identity band. Full-bleed rules (`-mx-1` against the
                    panel's own p-1) so they read as dividers rather than as a
                    boxed-in sub-panel. */}
                <div className="-mx-1 my-1 border-y border-line-soft px-3 py-2.5">
                  <div style={{ fontSize: 'var(--text-ui)', fontWeight: 600, lineHeight: 1.4, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontSize: 'var(--text-meta)', lineHeight: 1.4, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                </div>
                <div>
                  <DropdownMenuItem icon={<Icon icon={Settings} size={16} />} onSelect={() => router.push('/settings')}>Settings</DropdownMenuItem>
                  <DropdownMenuItem icon={<Icon icon={Keyboard} size={16} />} onSelect={() => window.dispatchEvent(new Event('zb:open-command'))}>Keyboard shortcuts</DropdownMenuItem>
                  <ThemeToggleItem />
                  <DropdownMenuSeparator />
                  {/* Stays open: the confirm replaces the menu body in place, so
                      the row must NOT take Radix's default close-on-select. */}
                  <DropdownMenuItem danger icon={<Icon icon={LogOut} size={16} />} onSelect={(e) => { e.preventDefault(); setConfirmSignout(true); }}>Sign out</DropdownMenuItem>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {newSpace && <NewSpaceModal onClose={() => setNewSpace(false)} onCreated={() => { setNewSpace(false); router.refresh(); }} />}
    </div>
  );
}

// Vertical hairline between the topbar's right-cluster controls (Figma Line 7:
// 12px tall, elements-1).
function TopBarDivider() {
  return <span aria-hidden style={{ width: 1, height: 12, background: 'var(--color-elements-1)', flexShrink: 0 }} />;
}

// The "+ New" split control (DS v2): main half fires quick capture, the chevron
// half opens a small create menu.
function NewSplit() {
  const router = useRouter();
  const item = (label: string, icon: IconType, run: () => void) => (
    <DropdownMenuItem key={label} icon={<Icon icon={icon} size={16} />} onSelect={run}>{label}</DropdownMenuItem>
  );
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bordered, not filled. This is GLOBAL chrome — it is on screen on every
          page, directly above and at the same x as each page's own primary
          button, so a fill here meant two filled buttons stacked 8px apart on
          every single screen ("+ New" over "+ New invoice"). One filled accent
          is visible at a time (constitution), and the one that earns it is the
          page's action, not the permanent one. */}
      <span style={{ display: 'inline-flex', alignItems: 'stretch', background: 'transparent', border: '1px solid var(--color-border-strong)', borderRadius: 8, overflow: 'hidden' }}>
        <button onClick={() => window.dispatchEvent(new Event('zb:capture'))} className="zb-nav-item zb-press"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
          <Icon icon={Plus} size={16} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, lineHeight: '16px', fontWeight: 400, letterSpacing: '-0.084px', whiteSpace: 'nowrap' }}>New</span>
        </button>
        {/* Only the chevron half opens the menu; the main half is a direct
            action. Radix owns the half that opens — it brings Escape, roving
            arrows and focus restore, none of which the hand-rolled version had
            (it listened for `mousedown` and nothing else), and it PORTALS, so
            the panel can no longer be clipped by a scrolling ancestor the way
            an absolutely-positioned one can. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="New options" className="zb-nav-item zb-press"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px', border: 'none', borderLeft: '1px solid var(--color-border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
              <Icon icon={ChevronDown} size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} aria-label="New" className="w-[200px]">
            <DropdownMenuLabel>Create</DropdownMenuLabel>
            {item('Task', SquarePen, () => window.dispatchEvent(new Event('zb:capture')))}
            {item('Event', Calendar, () => router.push('/calendar'))}
            {item('Document', Scroll, () => router.push('/documents'))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}

// The GLOBAL app header. It names the CURRENT PAGE on the left and carries the
// actions that work everywhere on the right (search, plan/shutdown, bell, focus,
// + New). The page title lives here and only here — the page header below it
// never repeats it, it carries that page's own actions.
function TopBar({ current, isMobile, onOpenNav, focus = false }: { current: string; isMobile: boolean; onOpenNav: () => void; focus?: boolean }) {
  const mod = ALL.find((m) => m.id === current);
  const pathname = usePathname();
  const fallbackLabel = mod ? null : (pathname.split('/')[1]?.replace(/-/g, ' ') || 'Zenboard');

  // FOCUS MODE: one control, and it is the way out.
  //
  // Focus used to be a route that changed the CENTRE and left every piece of
  // chrome exactly where it was — the full sidebar, search, the rituals link,
  // the bell, the timer, + New. Eleven ways to leave, arranged around a screen
  // whose entire premise is not leaving. A mode that only dims the middle is
  // not a mode. What survives is the toggle, because a door you cannot find is
  // a trap rather than a focus aid.
  if (focus) {
    return (
      <div style={{ minHeight: 'var(--app-header-h, 44px)', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 'var(--r-lg)', padding: 'var(--app-header-inset, 8px)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, padding: 'var(--app-header-lead-px, 4px)' }}>
          <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Today</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', viewTransitionName: 'zb-topbar-actions' }}>
          <FocusToggle />
        </div>
      </div>
    );
  }

  return (
    // `--app-header-px` is shared with <PageHeader> so the two header rows'
    // controls line up on one vertical axis. Don't hardcode it here again.
    // Horizontal padding only. The shorthand used to apply `--app-header-px` on
    // all four sides, which pinned the token to <=8px: this row is a fixed 44px
    // and its controls are 28–30px, so 12px of vertical padding would have
    // squeezed them. Vertical centring does that job, leaving the token free to
    // be the header GUTTER it is named for — on both rows at once.
    <div style={{ minHeight: 'var(--app-header-h, 44px)', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 'var(--r-lg)', padding: 'var(--app-header-inset, 8px)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: 'var(--shadow-xs)' }}>
      {isMobile ? (
        <IconButton icon={<Icon icon={List} size={20} />} label="Open navigation" onClick={onOpenNav} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, padding: 'var(--app-header-lead-px, 4px)' }}>
          {/* 16, not 20: every other icon in this row is 16 and the label
              beside it is 14px text, so a 20px glyph out-weighed the word it
              belongs to. PageHeader's lead was already 16 — this was the row's
              one outlier. */}
          {mod && <Icon icon={mod.icon} size={16} weight={mod.weight ?? 'regular'} style={{ color: 'var(--color-text-tertiary)' }} />}
          <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400, color: 'var(--color-text-tertiary)', textTransform: fallbackLabel ? 'capitalize' : 'none', whiteSpace: 'nowrap' }}>{mod?.label ?? fallbackLabel}</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Right cluster (Figma 455:11812) — search · power · bell · focus · new,
          separated by 12px hairlines. */}
      {/* Same inset as the lead, so the row's two ends sit on one grid.
          Only the lead used to carry it: content began 16px from the left
          and ended 12px from the right, on every screen. */}
      {/* The cluster carries a view-transition name so that entering focus MOVES it rather than
          cross-fading it: in focus it is one control, here it is six, and the browser animates
          the box between those two states instead of painting both on top of each other. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: 'var(--app-header-lead-px, 4px)', viewTransitionName: 'zb-topbar-actions' }}>
        {/* Compact icon button — opens the command palette (⌘K). A persistent
            search field ate the header; the icon keeps chrome minimal and
            matches its power/bell/focus neighbours. */}
        <button aria-label="Search" title="Search (⌘K)" onClick={() => window.dispatchEvent(new Event('zb:open-command'))} className="zb-nav-item zb-press"
          style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--color-icon-default)', flexShrink: 0 }}>
          <Icon icon={Search} size={16} />
        </button>

        {!isMobile && <TopBarDivider />}

        {!isMobile && (() => { const evening = new Date().getHours() >= 17; return (
          <Link href={`/rituals?type=${evening ? 'daily_shutdown' : 'daily_plan'}`} className="zb-nav-item" aria-label={evening ? 'Shutdown' : 'Plan day'} title={evening ? 'Shutdown' : 'Plan day'}
            style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, color: 'var(--color-icon-default)', textDecoration: 'none', flexShrink: 0 }}>
            <Icon icon={Power} size={16} />
          </Link>
        ); })()}

        {!isMobile && <TopBarDivider />}

        {!isMobile && <NotificationsBell />}

        {!isMobile && <TopBarDivider />}

        {!isMobile && <FocusTimerButton />}

        {!isMobile && <FocusToggle />}

        {!isMobile && <TopBarDivider />}

        <NewSplit />
      </div>
    </div>
  );
}

// Launcher for the floating Focus timer (the draggable dial widget). A quiet
// ghost icon that toggles the persistent widget mounted in the shell.
function FocusTimerButton() {
  return (
    <button aria-label="Focus timer" title="Focus timer" onClick={() => window.dispatchEvent(new Event('zb:toggle-focus'))}
      className="zb-nav-item zb-press"
      style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--color-icon-default)', flexShrink: 0 }}>
      <Icon icon={Timer} size={16} />
    </button>
  );
}

function FocusToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const on = isFocusMode(pathname);
  // ONE CLICK, ONE CHANGE. The navigation runs inside a view transition, so the sidebar leaving
  // and the pane growing into its place are one continuous movement instead of a cut. The helper
  // falls through to a plain push where the API is missing or motion is reduced.
  const go = useCallback(() => {
    const dest = on ? FOCUS_EXIT_PATH : FOCUS_PATH;
    navigateWithTransition(() => router.push(dest), () => window.location.pathname === dest);
  }, [on, router]);

  // Focus mode is a toggle, so it wears the ONE toggle language — the DS switch (accent on /
  // recessed off). What it gained is what the switch could never say on its own: the glyph beside
  // it STATES the mode (a filled circle you are inside of, a hollow one you are not), the label
  // says which way the press goes, and the whole control is the seed the ambient edge light grows
  // from (`FocusEdge`). The icon swap is Emil's contextual crossfade — both glyphs in the DOM, one
  // absolutely positioned, scale 0.25→1 with a 4px blur — so the change reads as one mark
  // transforming rather than two marks swapping.
  return (
    <Tooltip content={on ? 'Leave focus mode · F' : 'Focus mode · F'}>
      <button onClick={go} role="switch" aria-checked={on} aria-label="Focus mode" className="zb-nav-item zb-press zb-focus-toggle" data-on={on || undefined}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
        <span aria-hidden className="zb-focus-glyph">
          <Icon icon={Circle} size={14} className="zb-focus-glyph-off" />
          <Icon icon={Circle} size={14} weight="fill" className="zb-focus-glyph-on" />
        </span>
        <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400, color: 'var(--color-ink-700)' }}>Focus</span>
        <SwitchTrack on={on} size="sm" />
      </button>
    </Tooltip>
  );
}

function BottomTabs({ current, onOpenNav }: { current: string; onOpenNav: () => void }) {
  // Mobile carries the My Day hat (capture · today · plan) — everything else via More.
  const tabs = MY_DAY;
  return (
    <nav style={{ display: 'flex', gap: 2, flexShrink: 0, padding: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)' }}>
      {tabs.map((t) => {
        const on = current === t.id;
        return (
          <Link key={t.id} href={t.href} style={{ flex: 1, minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', background: on ? 'var(--nav-active-bg)' : 'transparent', border: '1px solid transparent', borderRadius: 'var(--r-md)', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            <Icon icon={t.icon} size={20} weight={t.weight ?? navWeight(on)} />
            <span style={{ fontSize: 'var(--text-micro-size)', fontWeight: on ? 600 : 500 }}>{t.label}</span>
          </Link>
        );
      })}
      <button onClick={onOpenNav} aria-label="More" style={{ flex: 1, minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--r-md)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <Icon icon={List} size={20} />
        <span style={{ fontSize: 'var(--text-micro-size)', fontWeight: 500 }}>More</span>
      </button>
    </nav>
  );
}

export function AppShell({ name, email, spaces, pins, activeSpaceId, timezone = null, initialSidebarMode = DEFAULT_SIDEBAR_MODE, children }: {
  name: string; email: string; spaces: SpaceLite[]; pins: Pin[]; activeSpaceId?: string;
  /** The zone stored on the profile; <TimezoneSync> corrects it when it's wrong. */
  timezone?: string | null;
  /** Read from the cookie by the layout, so the first paint is already right. */
  initialSidebarMode?: SidebarMode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = ALL.find((m) => pathname.startsWith(m.href))?.id ?? '';
  // Focus is a MODE, not a page: it changes the shell, not just what the shell
  // contains. Derived from the path so it survives a refresh and a deep link,
  // and so the toggle stays a plain navigation with nothing to keep in sync.
  const focusMode = isFocusMode(pathname);
  const isMobile = useIsMobile();
  // The phone navigation drawer is a Radix Dialog: Escape closes it, Tab stays inside
  // it, the page behind stops scrolling, and Presence holds it for its exit. The
  // opener is remembered because the menu button is not a Dialog.Trigger (it lives in
  // TopBar and BottomTabs), and Radix only hands focus back to its own trigger.
  const [drawer, setDrawer] = useState(false);
  const drawerOpener = useRef<HTMLElement | null>(null);
  const openDrawer = () => {
    drawerOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDrawer(true);
  };
  // Seeded from the server's cookie read, so the FIRST paint already has the
  // right sidebar. These used to start 'expanded' and be corrected by an effect,
  // which reflowed the page one frame in for anyone not on the default.
  const [mode, setMode] = useState<SidebarMode>(initialSidebarMode);
  const [hovering, setHovering] = useState(false);

  // Preload/unlock the task-completion sound on the first user interaction so it
  // plays instantly (and isn't blocked by the browser autoplay policy).
  useEffect(() => { initTaskSound(); }, []);

  // The saved default now arrives from the server (cookie), so this effect no
  // longer decides the startup mode — it only applies the two things the server
  // genuinely cannot know:
  //   · a temporary switch made in THIS tab (sessionStorage is per-tab), and
  //   · a localStorage default from before the cookie existed, for an install
  //     that has not switched modes since.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_KEY);
      if (isSidebarMode(saved) && saved !== initialSidebarMode) {
        // Older install: adopt it and mirror it forward so the next render is
        // server-correct too.
        setMode(saved);
        writeSidebarCookie(saved);
      }
    } catch { /* storage unavailable */ }
    try {
      const session = window.sessionStorage.getItem(SIDEBAR_SESSION_KEY);
      if (isSidebarMode(session)) setMode(session);
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /**
   * Change the sidebar mode — and KEEP it.
   *
   * This used to be two functions: `changeMode` switched the sidebar for this
   * tab only (sessionStorage), and a separate "mark as default" saved the
   * startup mode. So the visible control did not persist and the persisting
   * control was a 16px circle explained only by a hover tooltip — pick
   * "Collapsed", open a new tab, and it is expanded again with no way to tell
   * why. One function now: choosing a mode writes all three places, which is
   * what a user already assumes happened.
   *
   * All three, deliberately: the COOKIE is what the server renders the first
   * paint from, sessionStorage keeps this tab in step without a re-read, and
   * localStorage is the older key that keeps an install consistent if the
   * cookie is cleared.
   */
  const changeMode = (m: SidebarMode) => {
    setMode(m);
    writeSidebarCookie(m);
    try { window.sessionStorage.setItem(SIDEBAR_SESSION_KEY, m); } catch { /* storage unavailable */ }
    try { window.localStorage.setItem(SIDEBAR_KEY, m); } catch { /* storage unavailable */ }
  };

  // In "hover" mode the sidebar sits collapsed and expands only while hovered.
  const collapsed = mode === 'collapsed' || (mode === 'hover' && !hovering);

  return (
    <ViewWidthProvider>
      {/* Figma HIfi shell frame (node 467:2295): canvas bg, 4px outer margin,
          4px gutters between the floating panels. */}
      <BootSplash />
      <FocusEdge on={focusMode} />
      <div style={{ height: '100dvh', display: 'flex', gap: 'var(--app-gutter)', padding: 'var(--app-gutter)', background: 'var(--canvas)' }}>
        {/* Sidebar (desktop) — absent in Focus mode. */}
        {!isMobile && !focusMode && (
          mode === 'hover' ? (
            // Reserve the collapsed rail's width and float the expanding panel over
            // the content (Notion-style), so hovering never reflows the page.
            // `--z-widget`, not a raw 40: this floats the expanding sidebar over
            // the page, so it has to clear the page's own sticky headers
            // (`--z-sticky`) while still sitting under every overlay.
            <div style={{ position: 'relative', width: 'var(--sidebar-w-collapsed)', minWidth: 'var(--sidebar-w-collapsed)', flexShrink: 0, zIndex: 'var(--z-widget)' }}
              onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0 }}>
                <Sidebar name={name} email={email} spaces={spaces} pins={pins} current={current} activeSpaceId={activeSpaceId}
                  collapsed={collapsed} mode={mode} onModeChange={changeMode} floating={hovering} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', viewTransitionName: 'zb-sidebar' }}>
              <Sidebar name={name} email={email} spaces={spaces} pins={pins} current={current} activeSpaceId={activeSpaceId}
                collapsed={collapsed} mode={mode} onModeChange={changeMode} />
            </div>
          )
        )}

        {/* Drawer (mobile) — same rule: no navigation while focusing. */}
        <RDlg.Root open={isMobile && !focusMode && drawer} onOpenChange={setDrawer}>
          <RDlg.Portal>
            {/* The scrim and the drawer are SIBLINGS: opacity on a parent fades its whole
                subtree, and as a child the drawer went see-through while it slid, with the
                page's text showing through the panel. Only the scrim fades. */}
            <RDlg.Overlay
              className="zb-enter fixed inset-0 z-overlay data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout"
              style={{ background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)' }}
            />
            {/* Enters from the left edge it lives on, on the drawer curve, and leaves the
                same way in half the time; a key closes it at once (zb-enter). */}
            <RDlg.Content
              aria-describedby={undefined}
              onCloseAutoFocus={(e) => { e.preventDefault(); drawerOpener.current?.focus(); }}
              className="zb-enter fixed bottom-2 left-2 top-2 z-modal outline-none data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left"
            >
              <RDlg.Title className="sr-only">Navigation</RDlg.Title>
              <Sidebar name={name} email={email} spaces={spaces} pins={pins} current={current} activeSpaceId={activeSpaceId} onNavigate={() => setDrawer(false)} />
            </RDlg.Content>
          </RDlg.Portal>
        </RDlg.Root>

        {/* Main column — top bar + content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, viewTransitionName: 'zb-main' }}>
          <TopBar current={current} isMobile={isMobile} onOpenNav={openDrawer} focus={focusMode} />
          <div data-view-shell style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {/* The floating ••• that used to live here is gone with the page
                menu itself. It held one device-wide preference (Full width),
                which now sits in Settings → Appearance; a permanent overflow
                button on every screen, absolutely positioned over whatever the
                page had drawn there, was the opposite of a hierarchy. */}
            {/* Content panel (B&G Figma 1:779): same #121212 panel as sidebar/header. */}
            {/* THE primary content scroll region — every view that does not
                manage its own scrolling inherits this one. `scroll-region`
                (ds-theme.css) reserves the scrollbar gutter so a page that
                scrolls and a page that does not occupy the same width. */}
            {/* The panel's surface is `CONTENT_PANE_SURFACE`, shared with a record
                opened as a full page inside this pane (PageView), so opening one
                changes what the panel shows, never what it looks like. */}
            <div className="scroll-region" style={{ height: '100%', ...CONTENT_PANE_SURFACE }}>
              {children}
            </div>
            {/* THE toaster (§4.41 says "mount once inside the content pane").
                It lives here, not in views: 12 components called toast() but
                only 6 mounted a host, so every toast raised by Forms, Habits,
                Settings and the doc surfaces — including Undo offers — went
                nowhere. The store is a module singleton, so a second mount
                would render every toast twice; views must NOT add their own. */}
            <Toaster />
          </div>
          {isMobile && !focusMode && <BottomTabs current={current} onOpenNav={openDrawer} />}
        </div>

        <Suspense fallback={null}><TaskDetailDrawer /></Suspense>
        {/* Persistent floating focus timer (desktop) — survives navigation,
            rehydrates a running session across refresh. Not in Focus mode: that
            screen has a session timer of its own, and two clocks disagreeing by
            a second is worse than either alone. */}
        {!isMobile && !focusMode && <FocusTimer activeSpaceId={activeSpaceId} />}
        <RealtimeSync />
        {/* The mutation queue's worker — mounted ONCE, like the toaster above
            and the scheduler below. It picks up anything the last tab failed to
            deliver, so an edit made a second before you closed the laptop is
            not lost. See lib/mutation-queue.ts. */}
        <MutationWorker />
        {/* The queue reports its own refusals; this reports the ones that never
            reached a call site's `if ('error' in res)` because the action threw. */}
        <ActionFailureNet />
        {/* Reminder delivery (§7O channel 3). A module-level timer with a
            module-level claim, so it must be mounted EXACTLY once — a second
            mount is a second scheduler racing the first for every claim.
            Renders nothing; hides itself entirely without migration 0031. */}
        <ReminderScheduler />
        <TimezoneSync stored={timezone} />
        <CommandPalette />
        <GlobalShortcuts />
        <QuickCapture />
        {/* .zb-nav-item hover/transition now lives in globals.css (shared with in-page rails). */}
      </div>
    </ViewWidthProvider>
  );
}
