import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// `keepFocus` — a menu that was only pointed at must not take the caret.
//
// Measured 2026-09-14 on the Documents trail with a real pointer: writing in a
// document, then moving the mouse across the breadcrumb, moved focus INTO the
// hover-opened menu, and when it closed, onto the crumb. The caret was gone from
// the page. The fix leans on a Radix prop its TYPES keep private
// (`onOpenAutoFocus`), which only works because Radix passes Content props
// through. Both halves are held here, so a Radix upgrade that stops passing it
// fails a test instead of quietly bringing the bug back.
describe('DropdownMenuContent keepFocus', () => {
  const ds = readFileSync('components/ds/ui/dropdown-menu.tsx', 'utf8');

  it('declines Radix focus on open, and focus-return on close', () => {
    expect(ds).toMatch(/keepFocus \? \{ onOpenAutoFocus: \(e: Event\) => e\.preventDefault\(\) \}/);
    expect(ds).toMatch(/if \(keepFocus\) e\.preventDefault\(\)/);
  });

  it('relies on a Radix build that still passes Content props through to the focus scope', () => {
    const dropdown = readFileSync('node_modules/@radix-ui/react-dropdown-menu/dist/index.mjs', 'utf8');
    const menu = readFileSync('node_modules/@radix-ui/react-menu/dist/index.mjs', 'utf8');
    // DropdownMenuContent spreads what it is given into Menu's Content…
    expect(dropdown).toMatch(/\.\.\.contentProps/);
    // …which composes `onOpenAutoFocus` BEFORE its own focus call, so a
    // prevented event skips it.
    expect(menu).toMatch(/onMountAutoFocus: composeEventHandlers\(onOpenAutoFocus,/);
  });

  it('is what the breadcrumb trail uses for a menu opened by hover', () => {
    const crumbs = readFileSync('components/ds/ui/breadcrumbs.tsx', 'utf8');
    expect(crumbs).toMatch(/keepFocus=\{hover\.byHover\}/);
    expect(crumbs).toMatch(/autoFocusFilter=\{!hover\.byHover\}/);
  });
});
