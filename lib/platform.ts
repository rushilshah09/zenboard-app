// Modifier keys render as platform symbols, detected once at boot (§4.5).
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

// Map a token to its glyph + spoken name. Tokens are platform-neutral so callers
// write <Kbd keys={["mod","K"]} /> and get ⌘K on macOS, Ctrl K elsewhere.
const KEY: Record<string, { glyph: string; say: string }> = {
  mod: isMac ? { glyph: "⌘", say: "Command" } : { glyph: "Ctrl", say: "Control" },
  shift: isMac ? { glyph: "⇧", say: "Shift" } : { glyph: "Shift", say: "Shift" },
  alt: isMac ? { glyph: "⌥", say: "Option" } : { glyph: "Alt", say: "Alt" },
  ctrl: isMac ? { glyph: "⌃", say: "Control" } : { glyph: "Ctrl", say: "Control" },
  enter: { glyph: "↵", say: "Enter" },
  esc: { glyph: "Esc", say: "Escape" },
  tab: { glyph: "⇥", say: "Tab" },
  del: { glyph: "⌫", say: "Delete" },
};

export function keyGlyph(token: string): string {
  return KEY[token.toLowerCase()]?.glyph ?? token;
}

export function keyName(token: string): string {
  return KEY[token.toLowerCase()]?.say ?? token;
}

export { isMac };
