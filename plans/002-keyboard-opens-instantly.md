# 002 — What a keyboard opens appears instantly

- **Status**: DONE 2026-09-17 (the guard counts markers per file; building it exposed a hole in the shared `code()` helper, fixed)
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-16)
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 new lib module + 1 boot component + 1 CSS rule, a marker class on ~35 lines across ~25 files, 2 lines in the motion seam, 1 guard block

## Problem

Emil Kowalski: "Never animate keyboard-initiated actions. These actions are repeated hundreds
of times daily." Zenboard is keyboard-first (`components/shell/keyboard-shortcuts.tsx`: `g t`,
`g k`, `f`, `c`, `?`, and in a task list `j/k/↵/e/t/s/p/l/1/2/3`), yet almost everything a key
opens still plays its entrance. Only ⌘K and the capture composer are instant today.

Measured on the dev server with animations slowed to 10% (Chrome DevTools protocol,
`Animation.setPlaybackRate`, then `document.getAnimations()`):

| Key | What ran |
| --- | --- |
| `s` on `/dev-preview/tasks` (the Schedule menu) | `zb-pop-in`, 100ms, on `div[role=menu]` |
| `/` in `/dev-preview/editor` (the slash menu) | `zb-pop-in`, 100ms, on the menu panel |

Found by reading the code, and just as frequent:

```tsx
// components/shell/keyboard-shortcuts.tsx:106-108 — `g <key>` pushes a route…
if (dest) { e.preventDefault(); router.push(dest.href); return; }
```
```css
/* app/globals.css:656-657 — …and every page fades in on arrival */
@keyframes zb-page-in { from { opacity: 0; } to { opacity: 1; } }
.zb-page-in { animation: zb-page-in var(--duration-base, 150ms) var(--ease-out-quiet, ease-out); }
```
```tsx
// components/tasks/triage.tsx:231 — triage is driven by E / T / D / ↵, and every
// decision remounts the card (key={cur.id}) and replays a 150ms rise
<div key={cur.id} style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>
```
```tsx
// components/ds/ui/menu.tsx:44 — the panel behind the S/P/L task menus, the slash
// menu and the @ mention menu
export const MENU_PANEL_CLASS = `${OVERLAY_CLASS} p-1 [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]`;
```

`↵` opens the focused task into PageView's side peek (`components/ds/ui/page-view.tsx:394`,
`animate-slide-in-right`), and ⌘↵ / ⌥↵ / Ctrl+\ switch PageView modes, each replaying an
entrance. The DS `CommandMenu` (`components/ds/ui/command-menu.tsx:180,187`) animates open
and closed, which Emil names outright ("Raycast has no open/close animation").

## Target

One fact, one rule. The app records whether the LAST interaction was a key or a pointer on
`<html data-input="keyboard|pointer">`, and one stylesheet rule turns off the entrance (and
exit) of every surface that wears a marker class while the keyboard is driving:

```css
html[data-input="keyboard"] .zb-enter,
html[data-input="keyboard"] .zb-page-in { animation: none !important; }
```

A click still gets the motion: the same menu opened with a pointer animates exactly as
before. `!important` is required because several entrances are inline `style` animations.
Radix's `Presence` treats `animation-name: none` as "nothing to wait for" and unmounts at
once, and it treats `animationcancel` as the end of an exit, so a key pressed mid-exit is safe.

Cost: only elements with `.zb-enter` / `.zb-page-in` restyle when the attribute changes, and
the attribute is written only when the modality actually changes.

## Repo conventions to follow

- A small shared rule is a `lib/*.ts` module with a pure, unit-tested core and a thin
  browser wrapper, e.g. `lib/use-focus-return.ts` (`focusFellNowhere`, tested in
  `lib/use-focus-return.test.ts` with plain objects, because vitest runs in Node with no DOM).
- Boot components that render nothing and install document-level behaviour live in
  `components/shell/` and mount in `app/layout.tsx`, e.g. `components/shell/appearance-boot.tsx`.
- Guard tests live in `app/design-system.test.ts`. Helpers: `FILES` (source files),
  `code(file)` returns an ARRAY of lines with comments blanked, `walk(dir)` lists `.tsx`.
  Every guard starts with a must-fail control.
- Motion tokens: `--duration-fast` 100ms, `--duration-base` 150ms, `--ease-out-quiet`
  `cubic-bezier(0.23, 1, 0.32, 1)`. Do not add tokens in this plan.

## Steps

1. Create `lib/input-modality.ts`:

   ```ts
   // Which hand drove the last interaction: the keyboard or a pointer.
   //
   // Emil Kowalski's frequency rule, "never animate keyboard-initiated actions",
   // needs one fact CSS cannot know by itself: was it a key? This keeps that fact on
   // <html data-input>, where ONE stylesheet rule reads it (app/globals.css,
   // "NOTHING A KEYBOARD OPENS ANIMATES"). A pointer still gets the motion.
   export type InputModality = 'keyboard' | 'pointer';

   export const INPUT_ATTR = 'data-input';

   // A modifier pressed on its own says nothing yet: ⌘-click and shift-click are
   // pointer interactions, and the key that completes a chord reports itself.
   const MODIFIERS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'AltGraph', 'CapsLock', 'Fn']);

   /** What an event says about the hand driving the app, or null when it says nothing. */
   export function modalityOf(e: { type: string; key?: string }): InputModality | null {
     if (e.type === 'pointerdown') return 'pointer';
     if (e.type === 'keydown') return e.key && MODIFIERS.has(e.key) ? null : 'keyboard';
     return null;
   }

   const watching = new WeakSet<Document>();

   /** Start stamping <html data-input>. Returns the uninstall. Once per document. */
   export function installInputModality(doc: Document = document): () => void {
     const win = doc.defaultView;
     if (!win || watching.has(doc)) return () => {};
     watching.add(doc);
     const root = doc.documentElement;
     const on = (e: Event) => {
       const m = modalityOf(e as KeyboardEvent);
       // Write only on a change: every write restyles the elements that read it.
       if (m && root.getAttribute(INPUT_ATTR) !== m) root.setAttribute(INPUT_ATTR, m);
     };
     // Capture, on window: this runs before any handler the app has, so the page a
     // shortcut renders already knows a key asked for it.
     win.addEventListener('keydown', on, true);
     win.addEventListener('pointerdown', on, true);
     return () => {
       win.removeEventListener('keydown', on, true);
       win.removeEventListener('pointerdown', on, true);
       watching.delete(doc);
     };
   }

   /** The hand that drove the last interaction. Pointer until a key says otherwise. */
   export function lastInput(): InputModality {
     if (typeof document === 'undefined') return 'pointer';
     return document.documentElement.getAttribute(INPUT_ATTR) === 'keyboard' ? 'keyboard' : 'pointer';
   }
   ```

2. Create `lib/input-modality.test.ts`:

   ```ts
   import { describe, it, expect } from 'vitest';
   import { modalityOf } from './input-modality';

   describe('the hand that drove the last interaction', () => {
     it('a key is the keyboard, a press is the pointer', () => {
       expect(modalityOf({ type: 'keydown', key: 'k' })).toBe('keyboard');
       expect(modalityOf({ type: 'keydown', key: 'Enter' })).toBe('keyboard');
       expect(modalityOf({ type: 'pointerdown' })).toBe('pointer');
     });
     it('a modifier on its own says nothing, so a ⌘-click stays a click', () => {
       for (const key of ['Shift', 'Meta', 'Control', 'Alt']) expect(modalityOf({ type: 'keydown', key })).toBeNull();
     });
     it('other events say nothing', () => {
       expect(modalityOf({ type: 'pointermove' })).toBeNull();
       expect(modalityOf({ type: 'keyup', key: 'k' })).toBeNull();
     });
   });
   ```

3. Create `components/shell/input-modality-boot.tsx`:

   ```tsx
   'use client';
   // Stamps <html data-input> with the hand that drove the last interaction (see
   // lib/input-modality.ts). Mounted once in the root layout beside AppearanceBoot,
   // so the app, the portal, public forms and dev previews all read the same fact.
   import { useEffect } from 'react';
   import { installInputModality } from '@/lib/input-modality';

   export function InputModalityBoot() {
     useEffect(() => installInputModality(), []);
     return null;
   }
   ```

   In `app/layout.tsx`, import it (`import { InputModalityBoot } from "@/components/shell/input-modality-boot";`)
   and render `<InputModalityBoot />` on the line after `<AppearanceBoot />` (currently line 53).

4. In `app/globals.css`, directly AFTER the closing `}` of the reduced-motion block that ends
   with `@keyframes indeterminate { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }`
   (currently line 708), insert:

   ```css
   /* ── NOTHING A KEYBOARD OPENS ANIMATES ─────────────────────────────────────
      Emil Kowalski: "Never animate keyboard-initiated actions. These actions are
      repeated hundreds of times daily." A shortcut is a promise of speed, so what
      it opens is simply there. lib/input-modality.ts stamps <html data-input> with
      the hand that drove the last interaction; every entrance a key can reach wears
      `zb-enter`, and a page's entrance is `.zb-page-in`. The same surface opened by
      a pointer animates as before. `!important` because some of these entrances
      are inline styles. Exits are covered too: Escape closes without a flourish. */
   html[data-input="keyboard"] .zb-enter,
   html[data-input="keyboard"] .zb-page-in { animation: none !important; }
   ```

5. Add the marker class `zb-enter` to every keyboard-reachable entrance, on the element that
   runs the animation — in the same class string wherever the animation is a class (the guard
   in step 9 counts one marker per entrance line, per file). Current → target, exact:

   | File:line (current) | Current fragment | Target fragment |
   | --- | --- | --- |
   | `components/ds/ui/menu.tsx:44` | `` `${OVERLAY_CLASS} p-1 [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]` `` | `` `${OVERLAY_CLASS} p-1 zb-enter [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]` `` |
   | `components/ds/ui/dropdown-menu.tsx:62` and `:272` | `data-[state=open]:animate-emerge data-[state=closed]:animate-exit` | `zb-enter data-[state=open]:animate-emerge data-[state=closed]:animate-exit` |
   | `components/ds/ui/popover.tsx:38`, `hover-card.tsx:45` | `"data-[state=open]:animate-emerge data-[state=closed]:animate-exit",` | `"zb-enter data-[state=open]:animate-emerge data-[state=closed]:animate-exit",` |
   | `components/ds/ui/tooltip.tsx:60` | `"data-[state=delayed-open]:animate-emerge data-[state=closed]:animate-exit",` | `"zb-enter data-[state=delayed-open]:animate-emerge data-[state=closed]:animate-exit",` |
   | `components/ds/ui/filter.tsx:99`, `combobox.tsx:235`, `select.tsx:87` | `"data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-…",` | same string with `zb-enter ` prepended inside the quotes |
   | `components/ds/ui/modal.tsx:61` and `:152` (overlays) | `className="fixed inset-0 z-overlay …data-[state=open]:animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]"` | prepend `zb-enter ` inside the quotes |
   | `components/ds/ui/modal.tsx:77` and `:162` | `"data-[state=open]:animate-rise data-[state=closed]:animate-exit",` | `"zb-enter data-[state=open]:animate-rise data-[state=closed]:animate-exit",` |
   | `components/ds/ui/drawer.tsx:66` and `:249` (overlays) | `…data-[state=open]:animate-fadein"` | prepend `zb-enter ` inside the quotes |
   | `components/ds/ui/drawer.tsx:80` and `:254` | `"data-[state=open]:animate-slide-in-…  data-[state=closed]:animate-slide-out-…",` | prepend `zb-enter ` inside the quotes |
   | `components/ds/ui/page-view.tsx:320` | `…outline-none data-[state=open]:animate-fadein"` | `…outline-none zb-enter data-[state=open]:animate-fadein"` |
   | `components/ds/ui/page-view.tsx:342` | `"data-[state=open]:animate-fadein",` | `"zb-enter data-[state=open]:animate-fadein",` |
   | `components/ds/ui/page-view.tsx:358` (overlay) | `…backdrop-blur-[2px] data-[state=open]:animate-fadein"` | `…backdrop-blur-[2px] zb-enter data-[state=open]:animate-fadein"` |
   | `components/ds/ui/page-view.tsx:367` | `"data-[state=open]:animate-rise",` | `"zb-enter data-[state=open]:animate-rise",` |
   | `components/ds/ui/page-view.tsx:394` | `"data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",` | prepend `zb-enter ` inside the quotes |
   | `components/ds/ui/full-screen-layer.tsx:69-70` | `fade: "animate-fadein",` / `blur: "[animation:blurin_…]",` | `fade: "zb-enter animate-fadein",` / `blur: "zb-enter [animation:blurin_var(--duration-slow)_var(--ease-out-quiet)]",` |
   | `components/ds/ui/checkbox.tsx:50` | `"grid place-content-center text-current transition-none animate-tick"` | `"grid place-content-center text-current transition-none zb-enter animate-tick"` |
   | `components/ds/ui/selection-bar.tsx:38` | `… shadow-lift-3 animate-rise",` | `… shadow-lift-3 zb-enter animate-rise",` |
   | `components/ds/ui/accordion.tsx:40` | `className="overflow-hidden data-[state=open]:animate-[reveal-down…` | `className="overflow-hidden zb-enter data-[state=open]:animate-[reveal-down…` |
   | `components/ui/popover.tsx:34` | `'animate-[zb-pop-in_var(--duration-base)_var(--ease-out-quiet)]',` | `'zb-enter animate-[zb-pop-in_var(--duration-base)_var(--ease-out-quiet)]',` |
   | `components/ui/popover.tsx:118` | `className="fixed inset-0 z-modal … animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]"` | prepend `zb-enter ` inside the quotes |
   | `components/ui/popover.tsx:128` | `'animate-[zb-modal-in_var(--duration-slow)_var(--ease-out-quiet)]',` | `'zb-enter animate-[zb-modal-in_var(--duration-slow)_var(--ease-out-quiet)]',` |
   | `components/ui/picker-panel.tsx:38` | `<div ref={ref} role="dialog" aria-label={label}` | `<div ref={ref} role="dialog" aria-label={label} className="zb-enter"` |
   | `components/task-detail/chip-ui.tsx:99` | `className={OVERLAY_CLASS}` | ``className={`${OVERLAY_CLASS} zb-enter`}`` |
   | `components/week/week-view.tsx:134` and `:359` | `<div ref={popRef} style={{…` / `<div ref={menuRef} style={{…` | `<div ref={popRef} className="zb-enter" style={{…` / `<div ref={menuRef} className="zb-enter" style={{…` |
   | `components/focus/focus-view.tsx:226` and `:320` | `<div className={OVERLAY_CLASS} style={{ position: 'absolute', …` | ``<div className={`${OVERLAY_CLASS} zb-enter`} style={{ position: 'absolute', …`` |
   | `components/documents/doc-properties.tsx:81` | `… bg-popover p-2 [animation:zb-pop-in_…]` | `… bg-popover p-2 zb-enter [animation:zb-pop-in_…]` |
   | `components/documents/rich-text.tsx:910` | `className="fixed z-dropdown [animation:zb-pop-in_…]"` | `className="fixed z-dropdown zb-enter [animation:zb-pop-in_…]"` |
   | `components/documents/block-editor.tsx:2735` | `'absolute left-0 top-[calc(100%+4px)] z-dropdown grid gap-0.5 p-1 [animation:fade-rise_…]'` | insert `zb-enter ` before `[animation:` |
   | `components/calendar/event-composer.tsx:132` | `'fixed max-h-[calc(100vh-24px)] w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto animate-emerge'` | insert `zb-enter ` before `animate-emerge` |
   | `components/forms/form-renderer.tsx:228` | `className="animate-fadein"` | `className="zb-enter animate-fadein"` |
   | `components/rituals/ritual-flow.tsx:75` | `<div style={{ width: '100%', maxWidth: 620, animation: 'fade-rise …' }}>` | `<div className="zb-enter" style={{ width: '100%', maxWidth: 620, animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>` |
   | `components/onboarding/onboarding-flow.tsx:84` | `<div className="w-[min(520px,100%)] rounded-2xl …" style={{ animation: 'fade-rise …' }}>` | insert `zb-enter ` at the start of that `className` |
   | `components/shell/app-shell.tsx:685` | `<div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 8, …, animation: 'slideIn …' }}>` | add `className="zb-enter"` before `style=` |
   | `components/tasks/triage.tsx:191` | `<div className="max-w-sm rounded-lg border border-line-soft bg-surface-raised p-1" style={{ animation: 'fade-rise …' }}>` | insert `zb-enter ` at the start of that `className` |
   | `components/tasks/triage.tsx:252` | `<div className="flex flex-wrap gap-2" style={{ animation: 'fade-rise …' }}>` | `<div className="zb-enter flex flex-wrap gap-2" style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>` |

6. `components/tasks/triage.tsx:231` — triage advances on every decision, dozens of times in
   one sitting, by key or by click. Remove the per-item entrance outright:
   `<div key={cur.id} style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>`
   becomes `<div key={cur.id}>`. Leave line 223 (the "Inbox is clear." reward) exactly as it
   is: a rare, once-per-sitting moment is where Emil allows delight.

7. `components/ds/ui/command-menu.tsx` — a command menu never animates. On line 180 delete
   ` data-[state=open]:animate-fadein` from the Overlay's `className`. Delete line 187
   (`"data-[state=open]:animate-rise data-[state=closed]:animate-exit",`) from the Content's
   `cn(...)`.

8. `components/ds/ui/motion.tsx` (the motion seam) — a row that arrives because a key
   created it appears in place. Add `import { lastInput } from '@/lib/input-modality';` after
   the `motion/react` import. Then:
   - In `Appear`, change `initial={still ? false : { opacity: 0, transform: \`translateY(${RISE}px)\` }}`
     to `initial={still || lastInput() === 'keyboard' ? false : { opacity: 0, transform: \`translateY(${RISE}px)\` }}`.
   - In `Move`, change `initial={still ? onlyFades(initial) : initial}` to
     `initial={still ? onlyFades(initial) : lastInput() === 'keyboard' ? false : initial}`.
   - Add one comment line above each: `// A key created it: it is simply there (Emil: never animate keyboard-initiated actions).`

9. Append to `app/design-system.test.ts`:

   ```ts
   describe('nothing a keyboard opens animates', () => {
     // Emil Kowalski: "Never animate keyboard-initiated actions." The S/P/L task menus,
     // the slash and @ menus, every g-chord page and each triage decision replayed an
     // entrance on a key. One rule in globals.css turns off anything wearing
     // `zb-enter` (or `.zb-page-in`) while <html data-input="keyboard">.
     const ENTRANCE = /\banimate-(?:emerge|rise|exit|fadein|tick|pop-in|slide-(?:in|out)-[a-z]+)\b|animate-\[(?:fadein|zb-pop-in|zb-modal-in|fade-rise|blurin|reveal-(?:down|up))_|\[animation:(?:zb-pop-in|fade-rise|fadein|blurin|reveal-(?:down|up))_|animation:\s*['"`](?:zb-pop-in|fade-rise|fadein|blurin|slideIn|emerge|rise)\b/;
     // Each for a reason that is not "a key could open it":
     const DECLARED: { file: string; has: string; why: string }[] = [
       { file: 'app/login/page.tsx', has: 'blurin', why: 'plays once on page load; nothing was pressed' },
       { file: 'components/tasks/triage.tsx', has: 'text-center', why: 'the "Inbox is clear" reward, once per sitting' },
     ];
     const css = readFileSync('app/globals.css', 'utf8');

     it('catches the shape it guards (control)', () => {
       expect(ENTRANCE.test("className={cn(MENU, '[animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]')}")).toBe(true);
       expect(ENTRANCE.test("style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}")).toBe(true);
       expect(ENTRANCE.test('className="animate-spin"')).toBe(false);
     });

     it('the stylesheet turns them off while the keyboard drives', () => {
       expect(css).toMatch(/html\[data-input="keyboard"\] \.zb-enter,\s*html\[data-input="keyboard"\] \.zb-page-in \{ animation: none !important; \}/);
     });

     it('every keyboard-reachable entrance wears zb-enter or says why not', () => {
       // Counted per file rather than per element: an inline `style` animation can sit
       // many lines below the `className` that carries the marker (chip-ui.tsx), so the
       // rule is "at least one marker for every entrance the file draws".
       const offenders: string[] = [];
       for (const file of new Set([...FILES.filter((f) => /\.tsx$/.test(f)), 'app/login/page.tsx'])) {
         const lines = code(file);
         const entrances = lines
           .map((line, i) => ({ line, n: i + 1 }))
           .filter(({ line }) => ENTRANCE.test(line))
           .filter(({ line }) => !DECLARED.some((d) => d.file === file && line.includes(d.has)));
         if (!entrances.length) continue;
         const markers = (lines.join('\n').match(/\bzb-enter\b/g) ?? []).length;
         if (markers < entrances.length) offenders.push(`${file} (${entrances.length} entrances at ${entrances.map((e) => e.n).join(', ')}; ${markers} zb-enter)`);
       }
       expect(offenders).toEqual([]);
     });

     it('a command menu never animates', () => {
       const src = code('components/ds/ui/command-menu.tsx').join('\n');
       expect(src).not.toMatch(/animate-(?:fadein|rise|exit|emerge)/);
     });

     it('the motion seam lets a key-created row simply be there', () => {
       const seam = readFileSync('components/ds/ui/motion.tsx', 'utf8');
       expect(seam.match(/lastInput\(\) === 'keyboard'/g)?.length).toBe(2);
     });
   });
   ```

   If `FILES` does not include `app/login/page.tsx`, the explicit add covers it; if it
   already does, the duplicate scan is harmless.

10. In the root `CLAUDE.md` at `/Users/rushilshah/Downloads/CLAUDE.md` (not `zenboard-web/CLAUDE.md`, which only imports other files), in the Interaction section,
    replace `Nothing a KEYBOARD opens animates (⌘K, the capture composer)` with
    `Nothing a KEYBOARD opens animates: ⌘K and the capture composer never do, and everything
    else a key can open wears \`zb-enter\`, which \`<html data-input="keyboard">\` switches
    off (lib/input-modality.ts)`.

## Boundaries

- Do NOT change any keyframe, token, duration or curve. Plans 003–005 do that.
- Do NOT remove any entrance other than triage's per-item fade (step 6) and the command
  menu (step 7). Everything else keeps its motion for pointer users.
- Do NOT touch `components/ds/ui/toast.tsx`: a toast is the system reporting, not the thing
  the key opened, and it animates with transitions, which this rule does not affect.
- Do NOT add dependencies.
- If a "current fragment" is not found at or near the stated line (drift since the commit
  stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits 0. `npx vitest run lib/input-modality.test.ts app/design-system.test.ts components/ui/page-layout.test.ts` passes.
  Remove `zb-enter` from `components/ds/ui/menu.tsx:44` and confirm the new guard FAILS naming
  that file, then restore it.
- **Feel check** (dev server on :3000):
  - `/dev-preview/tasks`: click the page body once, press `j`, then `s`. The Schedule menu is
    on screen in the same frame as the key (DevTools Animations panel records nothing).
    Close it, then open a DS dropdown in the header WITH THE MOUSE: it still emerges.
  - `/dev-preview/editor`: type `/` in a new paragraph. The slash menu appears with no fade.
  - With DevTools Animations at 10%, press Escape on a menu opened by mouse: it closes
    instantly (the Escape was a key). Open it again by mouse and click outside: it exits
    with its 100ms fade.
  - In the console, `document.documentElement.dataset.input` reads `keyboard` after a key and
    `pointer` after a click, and holding ⌘ alone does not change it.
  - Toggle `prefers-reduced-motion: reduce`: a pointer-opened menu still fades (no scale);
    a keyboard-opened one is simply there.
- **Done when**: on `/dev-preview/tasks`, `document.getAnimations().length` sampled 50ms
  after `s` (with `Animation.setPlaybackRate` at 0.1) contains no `zb-pop-in`, and the same
  sample after a mouse click on a dropdown trigger contains `emerge`.
