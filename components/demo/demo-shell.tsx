'use client';
// ── THE APP'S SHELL, FOR THE DEMO ───────────────────────────────────────────
//
// `AppShell` (components/shell/app-shell.tsx) cannot be mounted on a public page: it opens a realtime
// connection, drains the mutation queue, schedules reminders, syncs the timezone and mounts the global
// shortcuts, all of which assume a signed-in session. So this is its frame drawn again — the desk, the
// sidebar panel, the header panel and the content panel, at the same tokens and the same geometry —
// around the product's REAL views.
//
// It is a copy, so it is held to the original: site.test.ts reads the nav groups out of app-shell.tsx
// and fails if the demo's list, order or icons differ, and the shell's own parts are the real ones where
// they can be (`PinnedRail`, the demo mode of `NotificationsBell`, `FocusModeButton`, `CONTENT_PANE_SURFACE`,
// `railFade`). Every row is a plain link; the demo cancels link clicks and turns them into its own
// navigation (`onNavigate`), so nothing here ever loads an app route.

import * as React from 'react';
import {
  Calendar, ChevronDown, ChevronRight, Flame, Folder, Forms, FoldHorizontal, House, Landmark, List, MessageCircle,
  MousePointerClick, PanelLeft, Plus, Power, Scroll, Search, SquarePen, Target, Timer, UnfoldHorizontal, Users, Video,
  type IconType,
} from '@/components/ds/icons';
import {
  CONTENT_PANE_SURFACE, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger, Icon, IconButton, Logo, Toaster,
} from '@/components/ds/ui';
import { NotificationsBell } from '@/components/shell/notifications-bell';
import { PinnedRail } from '@/components/shell/pinned-rail';
import { RAIL_MOTION, railFade } from '@/components/shell/rail-motion';
import { navRowStyle, NavDivider, NAV_GLYPH_SLOT, TOOLBAR_ICON_BUTTON, ToolbarActions, FocusModeButton, SPLIT_FRAME, SPLIT_MAIN, SPLIT_MENU, WORKSPACE_AVATAR } from '@/components/shell/shell-parts';
import type { Pin } from '@/lib/pins';
import { useNarrow } from '@/lib/use-narrow';

export type NavDef = { id: string; label: string; icon: IconType; href: string };

// THE APP'S THREE GROUPS, in the app's order (app-shell.tsx `MY_DAY`, `WORK`, `HORIZON`).
export const MY_DAY: NavDef[] = [
  { id: 'today', label: 'Home', icon: House, href: '/today' },
  { id: 'tasks', label: 'Tasks', icon: SquarePen, href: '/tasks' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
];
export const WORK: NavDef[] = [
  { id: 'projects', label: 'Projects', icon: Folder, href: '/projects' },
  { id: 'clients', label: 'Clients', icon: Users, href: '/clients' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, href: '/messages' },
  { id: 'forms', label: 'Forms', icon: Forms, href: '/forms' },
  { id: 'content', label: 'Content', icon: Video, href: '/content' },
  { id: 'documents', label: 'Docs', icon: Scroll, href: '/documents' },
  { id: 'money', label: 'Finance', icon: Landmark, href: '/money' },
];
export const HORIZON: NavDef[] = [
  { id: 'horizon', label: 'Goals', icon: Target, href: '/horizon' },
  { id: 'habits', label: 'Habits', icon: Flame, href: '/habits' },
];
export const ALL_NAV = [...MY_DAY, ...WORK, ...HORIZON];

type SidebarMode = 'expanded' | 'collapsed' | 'hover';
const SIDEBAR_MODES: { id: SidebarMode; label: string; icon: IconType }[] = [
  { id: 'expanded', label: 'Expanded', icon: UnfoldHorizontal },
  { id: 'collapsed', label: 'Collapsed', icon: FoldHorizontal },
  { id: 'hover', label: 'Expand on hover', icon: MousePointerClick },
];

function NavItem({ def, active, collapsed }: { def: NavDef; active: boolean; collapsed?: boolean }) {
  return (
    <a href={def.href} title={collapsed ? def.label : undefined} aria-label={collapsed ? def.label : undefined} aria-current={active ? 'page' : undefined} className="zb-nav-item" style={navRowStyle(active, collapsed)}>
      <Icon icon={def.icon} size={20} state={active} style={{ flexShrink: 0, color: 'currentColor' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...railFade(collapsed) }}>{def.label}</span>
    </a>
  );
}

function Sidebar({ current, pins, workspace, mode, onModeChange, collapsed, floating }: {
  current: string; pins: Pin[]; workspace: string; mode: SidebarMode; onModeChange: (m: SidebarMode) => void; collapsed: boolean; floating?: boolean;
}) {
  return (
    <div style={{
      width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', minWidth: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      height: '100%', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 'var(--r-lg)',
      boxShadow: floating ? 'var(--shadow-lg)' : 'var(--shadow-xs)', transition: `width ${RAIL_MOTION}, min-width ${RAIL_MOTION}, box-shadow var(--duration-fast) var(--ease-hover)`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
        <button
          type="button"
          onClick={collapsed ? () => onModeChange('expanded') : undefined}
          aria-label={collapsed ? 'Expand sidebar' : undefined}
          aria-hidden={collapsed ? undefined : true}
          tabIndex={collapsed ? undefined : -1}
          className="zb-press"
          style={{ width: collapsed ? 'var(--row-nav)' : 'auto', height: 'var(--row-nav)', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 0, overflow: 'visible', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: collapsed ? 'pointer' : 'default', pointerEvents: collapsed ? undefined : 'none' }}
        >
          <Logo height={20} style={{ color: 'var(--ink)', marginLeft: collapsed ? 'var(--nav-rail-px, 6px)' : 'var(--nav-px, 8px)', transition: `margin-left ${RAIL_MOTION}` }} wordmarkStyle={railFade(collapsed)} />
        </button>
        <button onClick={() => onModeChange('collapsed')} aria-label="Collapse sidebar" title="Collapse sidebar" className="zb-nav-item"
          tabIndex={collapsed ? -1 : undefined} aria-hidden={collapsed || undefined}
          style={{ ...TOOLBAR_ICON_BUTTON, marginLeft: 'auto', pointerEvents: collapsed ? 'none' : undefined, ...railFade(collapsed, 'background var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)') }}>
          <Icon icon={PanelLeft} size={16} weight="regular" />
        </button>
      </div>
      <div aria-hidden style={{ height: 1, background: 'var(--color-elements-1)', flexShrink: 0 }} />

      <nav aria-label="Zenboard" style={{ padding: 'var(--nav-inset, 8px)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 'var(--nav-row-gap, 6px)', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {MY_DAY.map((m) => <NavItem key={m.id} def={m} active={current === m.id} collapsed={collapsed} />)}
        <NavDivider />
        {WORK.map((m) => <NavItem key={m.id} def={m} active={current === m.id} collapsed={collapsed} />)}
        <NavDivider />
        {HORIZON.map((m) => <NavItem key={m.id} def={m} active={current === m.id} collapsed={collapsed} />)}
        {pins.length > 0 && <>
          <NavDivider />
          <PinnedRail pins={pins} collapsed={collapsed} />
        </>}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ padding: '6px var(--nav-inset, 8px) 0', display: 'flex' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Sidebar control" title="Sidebar control" className="zb-nav-item"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--nav-gap, 8px)', height: 'var(--row-nav)', width: '100%', padding: collapsed ? '0 var(--nav-rail-px, 6px)' : '0 var(--nav-px, 8px)', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', overflow: 'hidden', transition: `padding ${RAIL_MOTION}, background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover)` }}>
                <Icon icon={PanelLeft} size={20} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1, color: 'var(--color-text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap', ...railFade(collapsed) }}>Sidebar control</span>
                <span style={{ ...NAV_GLYPH_SLOT, ...railFade(collapsed) }}><Icon icon={ChevronRight} size={16} style={{ color: 'var(--color-icon-quiet)' }} /></span>
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
        <div style={{ borderTop: '1px solid var(--color-elements-1)', marginTop: 'var(--nav-row-gap, 6px)', padding: 'var(--nav-inset, 8px)', display: 'flex' }}>
          <div className="zb-nav-item" style={{ ...navRowStyle(false, collapsed), width: '100%', overflow: 'hidden' }}>
            <span style={NAV_GLYPH_SLOT}><span style={WORKSPACE_AVATAR}>{workspace[0]}</span></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--color-ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', ...railFade(collapsed) }}>{workspace}</span>
            <span style={{ ...NAV_GLYPH_SLOT, ...railFade(collapsed) }}><Icon icon={ChevronDown} size={16} style={{ color: 'var(--color-icon-quiet)' }} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sample notifications for the bell, in its own demo mode (no request is made for them). */
const NOTIFICATIONS = (() => {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  return [
    { id: 'n1', kind: 'approval', title: 'Priya approved the logo presentation', body: 'Ridgeline rebrand', link: null, read: false, created_at: ago(12) },
    { id: 'n2', kind: 'payment', title: 'INV-021 was paid, $4,200', body: 'Ridgeline', link: null, read: false, created_at: ago(95) },
    { id: 'n3', kind: 'request', title: 'Daniel sent a request', body: 'Beacon Health site: could we add a careers page?', link: null, read: true, created_at: ago(60 * 26) },
  ];
})();

function TopBar({ current, isMobile, onOpenNav, onFocus, onCreate }: {
  current: string; isMobile: boolean; onOpenNav: () => void; onFocus: () => void; onCreate: (href: string) => void;
}) {
  const mod = ALL_NAV.find((m) => m.id === current);
  return (
    <div style={{ minHeight: 'var(--app-header-h, 44px)', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 'var(--r-lg)', padding: 'var(--app-header-inset, 8px)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: 'var(--shadow-xs)' }}>
      {isMobile ? (
        <IconButton icon={<Icon icon={List} size={20} />} label="Open navigation" onClick={onOpenNav} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nav-gap, 8px)', minWidth: 0, padding: 'var(--app-header-lead-px, 4px)' }}>
          {mod && <Icon icon={mod.icon} size={16} weight="regular" style={{ color: 'var(--color-text-tertiary)' }} />}
          <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{mod?.label ?? 'Zenboard'}</span>
        </div>
      )}
      <div style={{ flex: 1 }} />
      <ToolbarActions style={{ paddingInline: 'var(--app-header-lead-px, 4px)' }}>
        <button aria-label="Search" title="Search (⌘K)" className="zb-nav-item zb-press" style={TOOLBAR_ICON_BUTTON}>
          <Icon icon={Search} size={16} />
        </button>
        {!isMobile && (
          <button aria-label="Plan day" title="Plan day" className="zb-nav-item zb-press" style={TOOLBAR_ICON_BUTTON}>
            <Icon icon={Power} size={16} />
          </button>
        )}
        {!isMobile && <NotificationsBell demo={NOTIFICATIONS} />}
        {!isMobile && (
          <button aria-label="Focus timer" title="Focus timer" onClick={onFocus} className="zb-nav-item zb-press" style={TOOLBAR_ICON_BUTTON}>
            <Icon icon={Timer} size={16} />
          </button>
        )}
        {!isMobile && <FocusModeButton on={false} onToggle={onFocus} />}
        <span style={SPLIT_FRAME}>
          <button onClick={() => onCreate('/tasks')} className="zb-nav-item zb-press" style={SPLIT_MAIN}>
            <Icon icon={Plus} size={16} style={{ flexShrink: 0 }} />
            <span>New</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="New options" className="zb-nav-item zb-press" style={SPLIT_MENU}>
                <Icon icon={ChevronDown} size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} aria-label="New" className="w-[200px]">
              <DropdownMenuLabel>Create</DropdownMenuLabel>
              <DropdownMenuItem icon={<Icon icon={SquarePen} size={16} />} onSelect={() => onCreate('/tasks')}>Task</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={Calendar} size={16} />} onSelect={() => onCreate('/calendar')}>Event</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={Scroll} size={16} />} onSelect={() => onCreate('/documents')}>Document</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </ToolbarActions>
    </div>
  );
}

function BottomTabs({ current, onOpenNav }: { current: string; onOpenNav: () => void }) {
  return (
    <nav style={{ display: 'flex', gap: 2, flexShrink: 0, padding: 4, background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 'var(--r-lg)' }}>
      {MY_DAY.map((t) => {
        const on = current === t.id;
        return (
          <a key={t.id} href={t.href} style={{ flex: 1, minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', background: on ? 'var(--nav-active-bg)' : 'transparent', border: '1px solid transparent', borderRadius: 'var(--r-md)', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            <Icon icon={t.icon} size={20} state={on} />
            <span style={{ fontSize: 'var(--text-micro-size)', fontWeight: on ? 600 : 500 }}>{t.label}</span>
          </a>
        );
      })}
      <button onClick={onOpenNav} aria-label="More" style={{ flex: 1, minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--r-md)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <Icon icon={List} size={20} />
        <span style={{ fontSize: 'var(--text-micro-size)', fontWeight: 500 }}>More</span>
      </button>
    </nav>
  );
}

/** The href a click landed on, if it was a link the demo should take over. */
function linkTarget(e: React.MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]');
  if (!a) return null;
  const href = a.getAttribute('href') ?? '';
  return href.startsWith('#') ? null : href;
}

export function DemoShell({ current, pins, workspace, onNavigate, onFocus, children }: {
  current: string;
  pins: Pin[];
  workspace: string;
  onNavigate: (href: string) => void;
  onFocus: () => void;
  children: React.ReactNode;
}) {
  const isMobile = useNarrow(820);
  const [mode, setMode] = React.useState<SidebarMode>('expanded');
  const [hovering, setHovering] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const collapsed = mode === 'collapsed' || (mode === 'hover' && !hovering);

  // EVERY LINK IS THE DEMO'S. A link anywhere in the app (a nav row, a pinned record, a task's
  // project, a breadcrumb) is cancelled here, in capture phase, before `next/link` can dispatch a real
  // navigation — it stands down on a cancelled click — and its address becomes the demo's.
  const onClickCapture = (e: React.MouseEvent) => {
    const href = linkTarget(e);
    if (href === null) return;
    e.preventDefault();
    setDrawer(false);
    onNavigate(href);
  };

  return (
    <div onClickCapture={onClickCapture} style={{ height: '100dvh', display: 'flex', gap: 'var(--app-gutter)', padding: 'var(--app-gutter)', background: 'var(--color-surface-desk)' }}>
      {!isMobile && (
        mode === 'hover' ? (
          <div style={{ position: 'relative', width: 'var(--sidebar-w-collapsed)', minWidth: 'var(--sidebar-w-collapsed)', flexShrink: 0, zIndex: 'var(--z-widget)' }}
            onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0 }}>
              <Sidebar current={current} pins={pins} workspace={workspace} mode={mode} onModeChange={setMode} collapsed={collapsed} floating={hovering} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex' }}>
            <Sidebar current={current} pins={pins} workspace={workspace} mode={mode} onModeChange={setMode} collapsed={collapsed} />
          </div>
        )
      )}
      {isMobile && drawer && (
        <div className="fixed inset-0 z-overlay" onClick={() => setDrawer(false)} style={{ background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)' }}>
          <div className="absolute bottom-2 left-2 top-2" onClick={(e) => e.stopPropagation()}>
            <Sidebar current={current} pins={pins} workspace={workspace} mode="expanded" onModeChange={setMode} collapsed={false} />
          </div>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <TopBar current={current} isMobile={isMobile} onOpenNav={() => setDrawer(true)} onFocus={onFocus} onCreate={onNavigate} />
        <div data-view-shell style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div className="scroll-region" style={{ height: '100%', ...CONTENT_PANE_SURFACE }}>{children}</div>
          <Toaster />
        </div>
        {isMobile && <BottomTabs current={current} onOpenNav={() => setDrawer(true)} />}
      </div>
    </div>
  );
}
