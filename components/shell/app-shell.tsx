'use client';
// App shell — Figma HIfi frame (nodes 467:2295 / 476:13435): floating panels on
// canvas with 4px gutters — 230px paper sidebar (logo header · nav groups split
// by elements-1 hairlines · Projects group label · sidebar control · workspace
// foot) beside a 44px header panel and a paper-3 content panel. Active nav =
// warm selected wash + 2×25 berry edge bar. Below 820px the sidebar becomes a
// drawer and a bottom tab bar appears.
import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { TaskDetailDrawer } from '@/components/task-detail/task-detail-drawer';
import { RealtimeSync } from '@/components/shell/realtime-sync';
import { NotificationsBell } from '@/components/shell/notifications-bell';
import { CommandPalette } from '@/components/shell/command-palette';
import { GlobalShortcuts } from '@/components/shell/keyboard-shortcuts';
import { QuickCapture } from '@/components/shell/quick-capture';
import { NewSpaceModal } from '@/components/shell/new-space-modal';
import { setActiveSpace } from '@/lib/actions/spaces';
import { ViewWidthProvider, PageOptionsMenu } from '@/components/shell/view-width';
import { ThemeToggleItem } from '@/components/shell/theme-toggle';
import { IconButton, SwitchTrack } from '@/components/ui/primitives';
import { initTaskSound } from '@/lib/sound';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Target, Folder, Users, Landmark, Scroll, Forms, Search, ChevronDown, ChevronRight, Plus, Settings, LogOut, Keyboard, SquarePen, Inbox, Check, House, Flame, PanelLeft, List, Power, UnfoldHorizontal, FoldHorizontal, MousePointerClick, type IconType } from "@/components/ds/icons";
import { Icon, Mark, Logo, Button, MenuPanel, MenuItem, MenuLabel, MenuSeparator } from "@/components/ds/ui";
import { createClient } from '@/lib/supabase/client';

type SpaceLite = { id: string; name: string; emoji: string | null; color: string; tag: string | null };
type ProjectLite = { id: string; name: string; color: string | null };
type NavDef = { id: string; label: string; icon: IconType; href: string; weight?: 'regular' | 'bold' | 'fill' };

// Sidebar behaviour — always expanded, always collapsed, or collapsed-with-hover-
// expand (Notion-style). The "Sidebar control" popover manages two independent
// states (DS v2 spec): the CURRENT mode (row click, immediate, temporary) and the
// DEFAULT STARTUP mode (right-hand radio indicator, persisted, restored on every
// launch). Current lives in sessionStorage (per-tab, survives in-tab reloads);
// default lives in localStorage.
type SidebarMode = 'expanded' | 'collapsed' | 'hover';
const SIDEBAR_MODES: { id: SidebarMode; label: string; icon: IconType }[] = [
  { id: 'expanded', label: 'Expanded', icon: UnfoldHorizontal },
  { id: 'collapsed', label: 'Collapsed', icon: FoldHorizontal },
  { id: 'hover', label: 'Expand on hover', icon: MousePointerClick },
];
const SIDEBAR_KEY = 'zb:sidebar';              // default startup mode (kept key for back-compat)
const SIDEBAR_SESSION_KEY = 'zb:sidebar:session'; // current mode for this tab
const isSidebarMode = (v: string | null): v is SidebarMode => v === 'expanded' || v === 'collapsed' || v === 'hover';

// Nav groups — MASTER_PRODUCT_PLAN §6.1: three hat-shaped groups (no section
// labels, just hairline dividers per the approved design). Route ids/hrefs are
// stable; only display labels evolve (Horizon → Goals, Money → Finance,
// Documents → Docs) so existing links, shortcuts and the palette keep working.
const MY_DAY: NavDef[] = [
  { id: 'today', label: 'Home', icon: House, href: '/today' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, href: '/inbox' },
  { id: 'tasks', label: 'Tasks', icon: SquarePen, href: '/tasks' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
];
const WORK: NavDef[] = [
  { id: 'projects', label: 'Projects', icon: Folder, href: '/projects' },
  { id: 'clients', label: 'Clients', icon: Users, href: '/clients' },
  { id: 'forms', label: 'Forms', icon: Forms, href: '/forms' },
  { id: 'documents', label: 'Docs', icon: Scroll, href: '/documents' },
  { id: 'money', label: 'Finance', icon: Landmark, href: '/money' },
];
const HORIZON: NavDef[] = [
  { id: 'horizon', label: 'Goals', icon: Target, href: '/horizon' },
  { id: 'habits', label: 'Habits', icon: Flame, href: '/habits' },
];
const ALL = [...MY_DAY, ...WORK, ...HORIZON];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

function NavItem({ def, active, onClick, collapsed }: { def: NavDef; active: boolean; onClick?: () => void; collapsed?: boolean }) {
  return (
    <Link
      href={def.href}
      onClick={onClick}
      title={collapsed ? def.label : undefined}
      aria-label={collapsed ? def.label : undefined}
      className="zb-nav-item"
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 4, height: 34,
        width: collapsed ? 34 : undefined, flexShrink: 0,
        padding: collapsed ? 0 : '8px', justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: active ? 8 : 6, textDecoration: 'none',
        background: active ? 'var(--color-surface-selected)' : undefined,
        color: active ? 'var(--color-ink-900)' : 'var(--color-text-secondary)',
        fontSize: 14, lineHeight: 1, fontWeight: active ? 500 : 400,
        transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
      }}
    >
      {/* B&G active nav (Figma 1:696): neutral white-8% wash, radius 8, ink-900
          medium label. No colored edge bar — monochrome rule. */}
      <Icon icon={def.icon} size={18} weight={def.weight ?? 'regular'} style={{ flexShrink: 0, color: 'currentColor' }} />
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.label}</span>}
    </Link>
  );
}

// Group separator — spans the full sidebar width (negative margin cancels the
// nav's horizontal padding), so it runs edge to edge with no side gaps.
function NavDivider({ collapsed }: { collapsed?: boolean }) {
  return <div aria-hidden style={{ height: 1, background: 'var(--color-elements-1)', flexShrink: 0, margin: collapsed ? '4px auto' : '4px -8px', width: collapsed ? '100%' : 'auto' }} />;
}

// The "Sidebar control" popover (DS v2 "pop up ui" spec, implemented exactly):
// a 230px sheet (paper-2, radius 12, popover shadow) with a paper-3 header strip
// and three option rows. Each row carries the component's two independent states —
//   · CURRENT ACTIVE: clicking the row switches the sidebar immediately; the
//     active row shows the warm selected wash. Temporary — never persisted.
//   · DEFAULT STARTUP: the 16px radio indicator on the right. The saved default
//     shows the accent donut; hovering an unset indicator shows the warm halo +
//     the "Mark as default" tooltip; clicking it saves that mode as the launch
//     default without changing the current mode.
function SidebarControl({ mode, defaultMode, onModeChange, onDefaultChange, collapsed }: {
  mode: SidebarMode; defaultMode: SidebarMode;
  onModeChange: (m: SidebarMode) => void; onDefaultChange: (m: SidebarMode) => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false); // plays the fade-out before unmount
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  // The sidebar clips its overflow, so the popover is portalled to <body> and
  // positioned from the button's rect (it can be wider than the collapsed rail).
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  // Subtle close: fade/slip out (110ms), then unmount.
  const close = () => {
    if (closeTimer.current != null) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => { setOpen(false); setClosing(false); closeTimer.current = null; }, 110);
  };
  useEffect(() => () => { if (closeTimer.current != null) window.clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (b) setPos({ left: b.left, bottom: window.innerHeight - b.top + 6 });
    };
    place();
    // Keyboard: focus lands on the selected row; Esc closes and returns focus.
    const t = window.setTimeout(() => {
      const sel = popRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
        ?? popRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]');
      sel?.focus();
    }, 0);
    const outside = (e: MouseEvent) => {
      const el = e.target as Node;
      if (btnRef.current?.contains(el) || popRef.current?.contains(el)) return;
      close();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); btnRef.current?.focus(); } };
    window.addEventListener('mousedown', outside);
    window.addEventListener('keydown', esc);
    window.addEventListener('resize', place);
    return () => { window.clearTimeout(t); window.removeEventListener('mousedown', outside); window.removeEventListener('keydown', esc); window.removeEventListener('resize', place); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]); // re-place when the mode switch resizes the sidebar under the trigger

  // Roving focus between rows (ArrowUp/Down wrap, Home/End jump).
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = [...(popRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
      : e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div style={{ padding: collapsed ? '6px 0 0' : '6px 8px 0', display: 'flex', justifyContent: collapsed ? 'center' : 'stretch' }}>
      <button ref={btnRef} onClick={() => (open ? close() : setOpen(true))} aria-haspopup="menu" aria-expanded={open} aria-label="Sidebar control" title="Sidebar control"
        className="zb-nav-item"
        style={collapsed
          ? { width: 34, height: 34, display: 'grid', placeItems: 'center', border: 'none', background: open ? 'var(--hover)' : undefined, borderRadius: 'var(--r-sm)', cursor: 'pointer' }
          : { display: 'flex', alignItems: 'center', gap: 8, height: 34, width: '100%', padding: '0 8px', borderRadius: 'var(--r-sm)', border: 'none', background: open ? 'var(--hover)' : undefined, cursor: 'pointer' }}>
        <Icon icon={PanelLeft} size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        {!collapsed && <span style={{ flex: 1, fontSize: 14, lineHeight: 1, color: 'var(--color-text-tertiary)', textAlign: 'left' }}>Sidebar control</span>}
        {!collapsed && <Icon icon={ChevronRight} size={18} style={{ color: 'var(--color-icon-quiet)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }} />}
      </button>

      {open && pos && createPortal(
        <div ref={popRef} role="menu" aria-label="Sidebar control" onKeyDown={onMenuKey}
          className="fixed z-[200] w-[230px] rounded-lg border border-line-strong bg-surface-raised p-1.5 shadow-lift-2"
          style={{ left: pos.left, bottom: pos.bottom, animation: closing ? 'zbScOut 110ms var(--ease) forwards' : 'zbScIn 150ms var(--ease)' }}>
          {/* Overline label — same as every other DS menu (no filled header strip).
              No overflow clip so the "Mark as default" tooltip can hang below. */}
          <div className="px-2 pt-1.5 pb-[3px] text-overline uppercase text-ink-500">Sidebar control</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SIDEBAR_MODES.map((o) => {
              const active = o.id === mode;
              const isDefault = o.id === defaultMode;
              return (
                <div key={o.id} className="zb-sc-row"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, height: 32 }}>
                  {/* The hover/selected pill wraps icon + label only — the radio sits outside it (design). */}
                  <button role="menuitemradio" aria-checked={active} onClick={() => { onModeChange(o.id); close(); }} className="zb-sc-label"
                    style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: active ? 'var(--hover)' : 'transparent', padding: '0 8px', borderRadius: 'var(--r-sm)', fontSize: 'var(--text-ui)', fontWeight: 400, color: active ? 'var(--ink-2)' : 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)' }}>
                    <Icon icon={o.icon} size={16} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  </button>
                  <span className="zb-sc-ind" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                    <button aria-label={isDefault ? `${o.label} is the default startup mode` : `Mark ${o.label} as default`} aria-pressed={isDefault}
                      onClick={() => onDefaultChange(o.id)}
                      style={{ width: 16, height: 16, padding: 0, borderRadius: 'var(--r-full)', cursor: 'pointer', display: 'inline-flex',
                        border: isDefault ? 'none' : '1px solid var(--line-3)',
                        background: isDefault ? 'var(--paper-2)' : 'transparent',
                        boxShadow: isDefault ? 'inset 0 0 0 3.5px var(--accent)' : 'none',
                        transition: 'background var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)' }} />
                    {!isDefault && (
                      <span role="tooltip" className="zb-sc-tip"
                        style={{ position: 'absolute', top: 'calc(100% + 4px)', right: -8, zIndex: 210, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0, background: 'var(--tip-bg)', color: 'var(--tip-text)', fontSize: 'var(--text-micro-size)', lineHeight: '10px', padding: '4px 6px', borderRadius: 'var(--r-xs)', transition: 'opacity var(--dur-fast) var(--ease)' }}>
                        Mark as default
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <style>{`
            .zb-sc-row:hover .zb-sc-label { background: var(--hover); color: var(--ink-2); }
            .zb-sc-row:focus-within .zb-sc-label { background: var(--hover); }
            .zb-sc-ind:hover > button[aria-pressed="false"] { background: var(--hover); }
            .zb-sc-ind:hover .zb-sc-tip, .zb-sc-ind:focus-within .zb-sc-tip { opacity: 1; }
            @keyframes zbScIn { from { opacity: 0; transform: translateY(4px); } }
            @keyframes zbScOut { to { opacity: 0; transform: translateY(4px); } }
            @media (prefers-reduced-motion: reduce) { [role="menu"][aria-label="Sidebar control"] { animation: none !important; } }
          `}</style>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Sidebar({ name, email, spaces, projects, current, activeSpaceId, onNavigate, mode, defaultMode, onModeChange, onDefaultChange, collapsed, floating }: {
  name: string; email: string; spaces: SpaceLite[]; projects: ProjectLite[]; current: string; activeSpaceId?: string; onNavigate?: () => void; mode?: SidebarMode; defaultMode?: SidebarMode; onModeChange?: (m: SidebarMode) => void; onDefaultChange?: (m: SidebarMode) => void; collapsed?: boolean; floating?: boolean;
}) {
  const [activeId, setActiveId] = useState(activeSpaceId ?? spaces[0]?.id);
  const [newSpace, setNewSpace] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignout, setConfirmSignout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPopRef = useRef<HTMLDivElement>(null);
  // The workspace menu is portalled to <body> (like SidebarControl) so the
  // sidebar's `overflow: hidden` can't clip it when the rail is collapsed —
  // otherwise the popover renders cut off to the rail's narrow width.
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const space = spaces.find((s) => s.id === activeId) ?? spaces[0];

  useEffect(() => { if (activeSpaceId) setActiveId(activeSpaceId); }, [activeSpaceId]);
  useEffect(() => {
    if (!menuOpen) return;
    const place = () => {
      const b = menuBtnRef.current?.getBoundingClientRect();
      if (b) setMenuPos({ left: b.left, bottom: window.innerHeight - b.top + 6, width: collapsed ? 248 : Math.max(b.width, 220) });
    };
    place();
    const fn = (e: MouseEvent) => {
      const el = e.target as Node;
      if (menuBtnRef.current?.contains(el) || menuPopRef.current?.contains(el)) return;
      setMenuOpen(false); setConfirmSignout(false);
    };
    window.addEventListener('mousedown', fn);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('mousedown', fn); window.removeEventListener('resize', place); };
  }, [menuOpen, collapsed]);

  function pickSpace(id: string) { setActiveId(id); setMenuOpen(false); setActiveSpace(id).then(() => router.refresh()); }
  async function signOut() { await createClient().auth.signOut(); router.push('/login'); router.refresh(); }

  const avatar = (space?.emoji && space.emoji.trim()) || name.slice(0, 2).toUpperCase();

  return (
    <div style={{
      width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', minWidth: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      height: '100%', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 12,
      boxShadow: floating ? 'var(--shadow-lg)' : '0 1px 2px rgba(0,0,0,0.04)', transition: 'width var(--dur-collapse) var(--ease), min-width var(--dur-collapse) var(--ease), box-shadow var(--dur-fast) var(--ease)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Brand header (Figma 476:13437): 48px row, p-8, logo left · collapse
          button right; collapsed rail centers the mark. Border-b elements-1. */}
      <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? 0 : 8 }}>
        {collapsed ? (
          <button onClick={() => onModeChange?.('expanded')} aria-label="Expand sidebar" title="Expand sidebar" className="zb-press" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer' }}>
            <Mark size={20} />
          </button>
        ) : (
          <>
            <Logo height={20} style={{ color: 'var(--ink)', marginLeft: 4 }} />
            {onModeChange && (
              <button onClick={() => onModeChange('collapsed')} aria-label="Collapse sidebar" title="Collapse sidebar" className="zb-nav-item" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'var(--color-icon-default)' }}>
                <Icon icon={PanelLeft} size={16} weight="regular" />
              </button>
            )}
          </>
        )}
      </div>
      <div aria-hidden style={{ height: 1, background: 'var(--color-elements-1)', flexShrink: 0 }} />

      {/* Nav */}
      <nav style={{ padding: collapsed ? '8px 0 8px' : '8px 8px', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'stretch', gap: 4, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {MY_DAY.map((m) => <NavItem key={m.id} def={m} active={current === m.id} onClick={onNavigate} collapsed={collapsed} />)}
        <NavDivider collapsed={collapsed} />
        {WORK.map((m) => <NavItem key={m.id} def={m} active={current === m.id} onClick={onNavigate} collapsed={collapsed} />)}
        <NavDivider collapsed={collapsed} />
        {HORIZON.map((m) => <NavItem key={m.id} def={m} active={current === m.id} onClick={onNavigate} collapsed={collapsed} />)}
        {projects.length > 0 && <>
          <NavDivider collapsed={collapsed} />
          {/* Group label + indented children — Figma "Starred" treatment
              (476:13460): caret + 12px medium ink-300 label, items inset 12px. */}
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8, flexShrink: 0 }}>
              <Icon icon={ChevronDown} size={14} style={{ color: 'var(--color-ink-300)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 500, color: 'var(--color-ink-300)' }}>Projects</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: collapsed ? 0 : 12, alignItems: collapsed ? 'center' : 'stretch' }}>
          {projects.map((p) => {
            const active = pathname === `/projects/${p.id}`;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} onClick={onNavigate} aria-label={collapsed ? p.name : undefined}
                className="zb-nav-item"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, height: 34, width: collapsed ? 34 : undefined, flexShrink: 0, padding: collapsed ? 0 : '8px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: active ? 8 : 6, textDecoration: 'none', background: active ? 'var(--color-surface-selected)' : undefined, color: active ? 'var(--color-ink-900)' : 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1, fontWeight: active ? 500 : 400 }}>
                <Icon icon={Folder} size={18} style={{ flexShrink: 0, color: p.color ?? 'currentColor' }} />
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>}
              </Link>
            );
          })}
          </div>
        </>}
      </nav>

      {/* Foot — sidebar control (collapse) + workspace / account switcher.
          Dividers span the full sidebar width (foot has no horizontal padding). */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }} ref={menuRef}>
        {onModeChange && onDefaultChange && (
          <SidebarControl mode={mode ?? 'expanded'} defaultMode={defaultMode ?? 'expanded'} onModeChange={onModeChange} onDefaultChange={onDefaultChange} collapsed={!!collapsed} />
        )}
        {/* Workspace foot (Figma 476:13477): border-t elements-1 · p-8 · inner
            row p-4 rounded-6 · 24px paper-5 avatar · 14px name · 18px caret. */}
        <div style={{ borderTop: '1px solid var(--color-elements-1)', marginTop: 8, padding: 8, display: 'flex', justifyContent: collapsed ? 'center' : 'stretch' }}>
        {collapsed ? (
          <button ref={menuBtnRef} onClick={() => { setMenuOpen((v) => !v); setConfirmSignout(false); }} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={name} title={name} className="zb-press" style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--color-paper-5)', color: 'var(--color-ink-700)', border: 'none', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 400, cursor: 'pointer' }}>{[...avatar][0]}</button>
        ) : (
          <button ref={menuBtnRef} onClick={() => { setMenuOpen((v) => !v); setConfirmSignout(false); }} aria-haspopup="menu" aria-expanded={menuOpen} className="zb-nav-item" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 6, background: menuOpen ? 'var(--hover)' : 'transparent', border: 'none', cursor: 'pointer', width: '100%' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--color-paper-5)', color: 'var(--color-ink-700)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 400, flexShrink: 0 }}>{[...avatar][0]}</div>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 400, color: 'var(--color-ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }} title={email}>{name}&apos;s workspace</span>
            <Icon icon={ChevronDown} size={18} style={{ color: 'var(--color-icon-quiet)', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
          </button>
        )}
        </div>

        {menuOpen && menuPos && createPortal(
          <div ref={menuPopRef} role="menu" aria-label="Workspace and account"
            className="fixed z-[200] overflow-hidden rounded-lg border border-line-strong bg-surface-raised shadow-lift-2 [animation:zb-pop-in_120ms_var(--ease-standard)]"
            style={{ left: menuPos.left, bottom: menuPos.bottom, width: menuPos.width }}>
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
                <div style={{ padding: 6 }}>
                  <MenuLabel>Workspaces</MenuLabel>
                  {spaces.map((s) => (
                    <button key={s.id} onClick={() => pickSpace(s.id)} className="zb-nav-item" style={{ width: '100%', minWidth: 0, minHeight: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: 'none', background: s.id === activeId ? 'var(--color-surface-hover)' : 'transparent', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 'var(--r-sm)', background: s.color, color: 'var(--on-accent)', display: 'grid', placeItems: 'center', fontSize: 'var(--text-label-size)' }}>{s.emoji}</div>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-ui)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      {s.id === activeId && <Icon icon={Check} size={16} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />}
                    </button>
                  ))}
                  <button onClick={() => { setMenuOpen(false); setNewSpace(true); }} className="zb-nav-item" style={{ width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: 'none', background: 'transparent', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 'var(--r-sm)', border: '1px dashed var(--line)', display: 'grid', placeItems: 'center' }}><Icon icon={Plus} size={12} /></div>
                    <span style={{ flex: 1, fontSize: 'var(--text-ui)', fontWeight: 500 }}>New workspace</span>
                  </button>
                </div>
                <div style={{ margin: '2px 6px', padding: '10px 8px', borderTop: '1px solid var(--color-line-soft)', borderBottom: '1px solid var(--color-line-soft)' }}>
                  <div style={{ fontSize: 'var(--text-ui)', fontWeight: 600, lineHeight: 1.4, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontSize: 'var(--text-meta)', lineHeight: 1.4, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                </div>
                <div style={{ padding: 6 }}>
                  <MenuItem icon={<Icon icon={Settings} size={16} className="shrink-0" />} onClick={() => { setMenuOpen(false); router.push('/settings'); }}>Settings</MenuItem>
                  <MenuItem icon={<Icon icon={Keyboard} size={16} className="shrink-0" />} onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('zb:open-command')); }}>Keyboard shortcuts</MenuItem>
                  <ThemeToggleItem />
                  <MenuSeparator />
                  <MenuItem danger icon={<Icon icon={LogOut} size={16} className="shrink-0" />} onClick={() => setConfirmSignout(true)}>Sign out</MenuItem>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);
  const item = (label: string, icon: IconType, run: () => void) => (
    <MenuItem key={label} icon={<Icon icon={icon} size={16} className="shrink-0" />} onClick={() => { setOpen(false); run(); }}>{label}</MenuItem>
  );
  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* B&G "Multiaction dropdown button" (Figma 1:772): white-12% fill, radius 8,
          no outer border, ink label · white-12% inner divider · CaretDown segment. */}
      <span style={{ display: 'inline-flex', alignItems: 'stretch', background: 'var(--color-surface-fill)', borderRadius: 8, overflow: 'hidden' }}>
        <button onClick={() => window.dispatchEvent(new Event('zb:capture'))} className="zb-nav-item zb-press"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
          <Icon icon={Plus} size={16} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, lineHeight: '16px', fontWeight: 400, letterSpacing: '-0.084px', whiteSpace: 'nowrap' }}>New</span>
        </button>
        <button onClick={() => setOpen((v) => !v)} aria-label="New options" aria-haspopup="menu" aria-expanded={open} className="zb-nav-item zb-press"
          style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px', border: 'none', borderLeft: '1px solid var(--color-border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
          <Icon icon={ChevronDown} size={16} />
        </button>
      </span>
      {open && (
        <MenuPanel aria-label="New" className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[200px]">
          <MenuLabel>Create</MenuLabel>
          {item('Task', SquarePen, () => window.dispatchEvent(new Event('zb:capture')))}
          {item('Event', Calendar, () => router.push('/calendar'))}
          {item('Document', Scroll, () => router.push('/documents'))}
        </MenuPanel>
      )}
    </div>
  );
}

function TopBar({ current, isMobile, onOpenNav }: { current: string; isMobile: boolean; onOpenNav: () => void }) {
  const mod = ALL.find((m) => m.id === current);
  const pathname = usePathname();
  const fallbackLabel = mod ? null : (pathname.split('/')[1]?.replace(/-/g, ' ') || 'Zenboard');
  return (
    <div style={{ height: 44, background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 12, padding: isMobile ? '0 10px' : 8, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 8, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {isMobile ? (
        <IconButton icon={List} label="Open navigation" onClick={onOpenNav} iconSize={20} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, padding: 4 }}>
          {mod && <Icon icon={mod.icon} size={18} weight={mod.weight ?? 'regular'} style={{ color: 'var(--color-text-tertiary)' }} />}
          <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400, color: 'var(--color-text-tertiary)', textTransform: fallbackLabel ? 'capitalize' : 'none', whiteSpace: 'nowrap' }}>{mod?.label ?? fallbackLabel}</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Right cluster (Figma 455:11812) — search · power · bell · focus · new,
          separated by 12px hairlines. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

        {!isMobile && <FocusToggle />}

        {!isMobile && <TopBarDivider />}

        <NewSplit />
      </div>
    </div>
  );
}

function FocusToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const on = pathname.startsWith('/focus');
  // Focus mode is a toggle, so it wears the ONE toggle language — the DS switch
  // (accent on / recessed off). Presentational SwitchTrack since the row itself
  // is the button that flips it.
  return (
    <button onClick={() => router.push(on ? '/today' : '/focus')} role="switch" aria-checked={on} title="Focus mode" className="zb-nav-item zb-press"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
      <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400, color: 'var(--color-ink-700)' }}>Focus</span>
      <SwitchTrack on={on} size="sm" />
    </button>
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
            <Icon icon={t.icon} size={20} weight={t.weight ?? 'regular'} />
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

export function AppShell({ name, email, spaces, projects, activeSpaceId, children }: {
  name: string; email: string; spaces: SpaceLite[]; projects: ProjectLite[]; activeSpaceId?: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = ALL.find((m) => pathname.startsWith(m.href))?.id ?? '';
  const isMobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);
  const [mode, setMode] = useState<SidebarMode>('expanded');
  const [defaultMode, setDefaultMode] = useState<SidebarMode>('expanded');
  const [hovering, setHovering] = useState(false);

  // Preload/unlock the task-completion sound on the first user interaction so it
  // plays instantly (and isn't blocked by the browser autoplay policy).
  useEffect(() => { initTaskSound(); }, []);

  // Restore sidebar state: the saved default startup mode always wins on a fresh
  // launch; a mode switched temporarily in this tab (sessionStorage) survives
  // in-tab reloads without touching the saved default.
  useEffect(() => {
    let def: SidebarMode = 'expanded';
    try {
      const saved = window.localStorage.getItem(SIDEBAR_KEY);
      if (isSidebarMode(saved)) def = saved;
    } catch { /* storage unavailable */ }
    setDefaultMode(def);
    let cur = def;
    try {
      const session = window.sessionStorage.getItem(SIDEBAR_SESSION_KEY);
      if (isSidebarMode(session)) cur = session;
    } catch { /* storage unavailable */ }
    setMode(cur);
  }, []);
  // Temporary switch — current mode only, never the saved default.
  const changeMode = (m: SidebarMode) => {
    setMode(m);
    try { window.sessionStorage.setItem(SIDEBAR_SESSION_KEY, m); } catch { /* storage unavailable */ }
  };
  // "Mark as default" — persists the startup mode without changing the current one.
  const changeDefaultMode = (m: SidebarMode) => {
    setDefaultMode(m);
    try { window.localStorage.setItem(SIDEBAR_KEY, m); } catch { /* storage unavailable */ }
  };

  // In "hover" mode the sidebar sits collapsed and expands only while hovered.
  const collapsed = mode === 'collapsed' || (mode === 'hover' && !hovering);

  return (
    <ViewWidthProvider>
      {/* Figma HIfi shell frame (node 467:2295): canvas bg, 4px outer margin,
          4px gutters between the floating panels. */}
      <div style={{ height: '100dvh', display: 'flex', gap: 4, padding: 4, background: 'var(--canvas)' }}>
        {/* Sidebar (desktop) */}
        {!isMobile && (
          mode === 'hover' ? (
            // Reserve the collapsed rail's width and float the expanding panel over
            // the content (Notion-style), so hovering never reflows the page.
            <div style={{ position: 'relative', width: 'var(--sidebar-w-collapsed)', minWidth: 'var(--sidebar-w-collapsed)', flexShrink: 0, zIndex: 40 }}
              onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0 }}>
                <Sidebar name={name} email={email} spaces={spaces} projects={projects} current={current} activeSpaceId={activeSpaceId}
                  collapsed={collapsed} mode={mode} defaultMode={defaultMode} onModeChange={changeMode} onDefaultChange={changeDefaultMode} floating={hovering} />
              </div>
            </div>
          ) : (
            <Sidebar name={name} email={email} spaces={spaces} projects={projects} current={current} activeSpaceId={activeSpaceId}
              collapsed={collapsed} mode={mode} defaultMode={defaultMode} onModeChange={changeMode} onDefaultChange={changeDefaultMode} />
          )
        )}

        {/* Drawer (mobile) */}
        {isMobile && drawer && (
          <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 8, bottom: 8, left: 8, animation: 'slideIn 200ms' }}>
              <Sidebar name={name} email={email} spaces={spaces} projects={projects} current={current} activeSpaceId={activeSpaceId} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}

        {/* Main column — top bar + content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <TopBar current={current} isMobile={isMobile} onOpenNav={() => setDrawer(true)} />
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {!isMobile && (
              <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 30 }}>
                <PageOptionsMenu />
              </div>
            )}
            {/* Content panel (B&G Figma 1:779): same #121212 panel as sidebar/header. */}
            <div style={{ height: '100%', overflowY: 'auto', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {children}
            </div>
          </div>
          {isMobile && <BottomTabs current={current} onOpenNav={() => setDrawer(true)} />}
        </div>

        <Suspense fallback={null}><TaskDetailDrawer /></Suspense>
        <RealtimeSync />
        <CommandPalette />
        <GlobalShortcuts />
        <QuickCapture />
        {/* .zb-nav-item hover/transition now lives in globals.css (shared with in-page rails). */}
      </div>
    </ViewWidthProvider>
  );
}
