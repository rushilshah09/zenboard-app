// Which hand drove the last interaction: the keyboard or a pointer.
//
// Emil Kowalski's frequency rule, "never animate keyboard-initiated actions — they
// are repeated hundreds of times daily", needs one fact CSS cannot know by itself:
// was it a key? This keeps that fact on <html data-input>, where ONE stylesheet rule
// reads it (app/globals.css, "NOTHING A KEYBOARD OPENS ANIMATES"), and the motion
// seam reads it through `lastInput()`. A pointer still gets the motion.
//
// Measured before this existed (2026-09-17, animations at 10%): `s` on a task opened
// the Schedule menu on a 100ms `zb-pop-in`, `/` in a document opened the slash menu
// on the same, every `g <key>` page faded in, and each triage decision replayed a rise.
//
// Deliberately NOT `pointermove`: Chrome fires a synthetic mouse move when content
// scrolls or reflows under a still cursor (which `j`/`k` navigation does), and that
// would flip a keyboard session back to "pointer" between a key and what it opens.
export type InputModality = 'keyboard' | 'pointer';

export const INPUT_ATTR = 'data-input';

/**
 * What a hand-back to the pointer stamps on every entrance ALREADY on screen, so it never plays again. Lifting the
 * keyboard's `animation: none` would otherwise restart each open panel's entrance from its first frame — the task
 * panel slid in again from off-screen under the very press that changed hands, and that click landed on the page
 * behind it (2026-09-21). app/globals.css keeps a settled entrance still.
 */
export const ENTERED_ATTR = 'data-entered';
/** Everything the keyboard rule stills: the entrances a key can reach, and a page's own. */
export const ENTRANCES = '.zb-enter, .zb-page-in';

// A modifier pressed on its own says nothing yet: ⌘-click and shift-click are pointer
// interactions, and the key that completes a chord reports itself.
const MODIFIERS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'AltGraph', 'CapsLock', 'Fn', 'FnLock', 'Hyper', 'Super', 'OS']);

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
    // Written only on a change: every write restyles the elements that read it.
    const was = root.getAttribute(INPUT_ATTR);
    if (!m || was === m) return;
    // Back from the keyboard: whatever is on screen has already entered. Settle it BEFORE lifting the rule, or
    // lifting it hands every open panel its entrance again, from the first frame.
    if (m === 'pointer' && was === 'keyboard') for (const el of doc.querySelectorAll(ENTRANCES)) el.setAttribute(ENTERED_ATTR, '');
    root.setAttribute(INPUT_ATTR, m);
  };
  // Capture, on window: this runs before any handler the app has, so what a shortcut
  // opens already knows a key asked for it.
  win.addEventListener('keydown', on, true);
  win.addEventListener('pointerdown', on, true);
  return () => {
    win.removeEventListener('keydown', on, true);
    win.removeEventListener('pointerdown', on, true);
    watching.delete(doc);
  };
}

/** The hand that drove the last interaction. A pointer until a key says otherwise. */
export function lastInput(): InputModality {
  if (typeof document === 'undefined') return 'pointer';
  return document.documentElement.getAttribute(INPUT_ATTR) === 'keyboard' ? 'keyboard' : 'pointer';
}
