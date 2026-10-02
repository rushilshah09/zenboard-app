'use client';
// ── THE SHELL'S PARTS — one geometry for the app and for the demo ───────────
//
// `AppShell` (app-shell.tsx) and the website's `DemoShell` (components/demo/demo-shell.tsx) draw the
// same frame, and each used to spell it out for itself: the nav row, the group divider, the toolbar's
// icon buttons, its dividers and the "+ New" split. Two copies of one sidebar is how the demo's row
// gap came to read `2px` while the app's read `6px`, and how the toolbar's buttons ended up 28px tall
// with 8px corners beside a 30px split with 8px corners and a 34px switch. These are the shared parts;
// both shells draw with them, so a change to one row changes every row.
//
// THE COLUMN (2026-10-02, the consistency pass). Every row in the sidebar — the brand, the nav, the
// Pinned heading and its records, Sidebar control, the workspace — puts its glyph in ONE 20px column
// (the nav inset + the row inset from the panel's edge) and its label at ONE x after an 8px gap. They
// sat at five different x positions before: the logo 4px left of the icons, the pinned glyphs 4px
// right of them with a 4px gap, the workspace avatar 4px left with a 4px gap.

import * as React from 'react';
import { FocusMode } from '@/components/ds/icons';
import { Button, Icon, Tooltip } from '@/components/ds/ui';
import { RAIL_MOTION } from '@/components/shell/rail-motion';

/** The nav row — one geometry, one selected state, for every row in the sidebar. */
export function navRowStyle(active: boolean, collapsed?: boolean): React.CSSProperties {
  return {
    position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--nav-gap, 8px)', height: 'var(--row-nav, 32px)',
    // ONE geometry in both states (components/shell/rail-motion.ts): the row stretches to its
    // column, and only its inset glides with the panel.
    flexShrink: 0,
    padding: collapsed ? '0 var(--nav-rail-px, 6px)' : '0 var(--nav-px, 8px)', justifyContent: 'flex-start',
    // ONE radius in both states — a row that changes shape when selected is a row that wobbles.
    borderRadius: 'var(--r-sm, 6px)', textDecoration: 'none',
    background: active ? 'var(--color-surface-selected)' : undefined,
    color: active ? 'var(--color-ink-900)' : 'var(--color-text-secondary)',
    fontSize: 14, lineHeight: 1, fontWeight: active ? 500 : 400,
    transition: `padding ${RAIL_MOTION}, background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover)`,
  };
}

/** The glyph slot every sidebar row shares: 20px wide, so a 16px record glyph and a 20px module
 *  glyph both centre on the same axis and their labels start at the same x. */
export const NAV_GLYPH_SLOT: React.CSSProperties = { width: 20, height: 20, display: 'grid', placeItems: 'center', flexShrink: 0 };

/** A group separator in the sidebar — edge to edge of the panel (the negative margin cancels the
 *  nav's own inset), with the same air above and below. */
export function NavDivider() {
  return <div aria-hidden style={{ height: 1, background: 'var(--color-elements-1)', flexShrink: 0, margin: '4px calc(-1 * var(--nav-inset, 8px))' }} />;
}

/** The toolbar's icon button: 28px square — the height of every control in a 44px header row —
 *  at the control radius. */
export const TOOLBAR_ICON_BUTTON: React.CSSProperties = {
  width: 'var(--ctl-sm, 28px)', height: 'var(--ctl-sm, 28px)', display: 'grid', placeItems: 'center',
  background: 'transparent', border: 'none', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer',
  color: 'var(--color-icon-default)', flexShrink: 0, textDecoration: 'none',
};

/** The hairline between two toolbar actions: 16px tall, the glyph's height. It takes no margin of
 *  its own; `ToolbarActions` spaces it. */
export function ToolbarDivider() {
  return <span aria-hidden className="zb-toolbar-sep" style={{ width: 1, height: 16, background: 'var(--color-elements-1)', flexShrink: 0 }} />;
}

/** The top bar's actions, with A HAIRLINE BETWEEN EVERY ONE (user, 2026-10-02: "add separator
 *  between all action"). It reverses the same day's one-group-one-divider version, which the user
 *  saw and asked to change.
 *
 *  The hairlines are placed here rather than written between the children, so a caller cannot
 *  forget one or double one up. `Children.toArray` drops the `{!isMobile && …}` holes. An action
 *  that is present but renders NOTHING (the recording indicator, between meetings) would leave two
 *  hairlines touching, and globals.css hides the second one (`.zb-toolbar-sep + .zb-toolbar-sep`).
 *
 *  6px either side of a hairline puts it 12px from the glyph beside it, because a 28px icon button
 *  holds its 16px glyph 6px in from each edge. */
export function ToolbarActions({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const items = React.Children.toArray(children);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ToolbarDivider />}
          {item}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Focus mode's toggle, in Linear's grammar for a toggle in a toolbar: a GHOST button with a glyph
 *  and a word (their "Agent" button), and while the mode is on it holds the pressed wash and the
 *  glyph cross-fades to its filled cut (`<Icon state>`, never a one-frame weight swap). It is the DS `<Button>` with its `toggle` variant, which supplies the
 *  height, corner, press, focus ring and `aria-pressed` styling every other toggle button has.
 *
 *  It replaces the labelled sliding switch ("Off / Focus / on", 2026-09-28): the user, 2026-10-02:
 *  "i dont like focus button make it like linear". A button that is pressed or not says on/off
 *  with one word, where the switch needed three. */
export function FocusModeButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Tooltip content={on ? 'Leave focus mode · F' : 'Focus mode · F'}>
      <Button variant="ghost" size="sm" toggle aria-pressed={on} aria-label="Focus mode" onClick={onToggle}
        icon={<Icon icon={FocusMode} state={on} />}>
        Focus
      </Button>
    </Tooltip>
  );
}

/** The "+ New" split: the secondary button's shape at the toolbar's height (28px, control radius,
 *  the decorative edge), two halves divided by the same edge. Bordered, never filled — it is on
 *  every screen, directly above each page's own primary action. */
export const SPLIT_FRAME: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'stretch', height: 'var(--ctl-sm, 28px)', background: 'transparent',
  border: '1px solid var(--color-border-strong)', borderRadius: 'var(--r-sm, 6px)', overflow: 'hidden', flexShrink: 0,
};
export const SPLIT_MAIN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px 0 8px', border: 'none', background: 'transparent',
  // 500, the weight of every DS button label: it sits beside the Focus button in one row.
  cursor: 'pointer', color: 'var(--ink)', fontSize: 14, fontWeight: 500, lineHeight: '20px', whiteSpace: 'nowrap',
};
export const SPLIT_MENU: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '0 6px', border: 'none', borderLeft: '1px solid var(--color-border-strong)',
  background: 'transparent', cursor: 'pointer', color: 'var(--ink)',
};

/** The workspace row at the foot of the sidebar: the avatar in the glyph column, the name at the
 *  label x, and the row's own geometry (32px, the control radius). */
export const WORKSPACE_AVATAR: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 'var(--r-xs, 4px)', background: 'var(--color-paper-5)', color: 'var(--color-ink-700)',
  display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 500, lineHeight: 1, flexShrink: 0,
};
