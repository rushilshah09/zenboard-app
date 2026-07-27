import { keyGlyph, keyName } from "@/lib/platform";
import { cn } from "@/lib/cn";

// design-system.md §4.5 — a rendered keyboard key; how Zenboard teaches itself.
// A combo is ONE <kbd> (⌘K), not two. `keys` are platform-neutral tokens
// ("mod","shift","K") resolved to ⌘/Ctrl glyphs once at boot.
export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  const glyphs = keys.map(keyGlyph).join("");
  const name = keys.map(keyName).join(" ");
  // aria-label is prohibited on <kbd>; instead the glyphs are aria-hidden and the
  // spoken name is a visually-hidden alternative (§4.5).
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-paper-3 px-1",
        // ink-600 (not spec's ink-500) so 11px key text clears AA on paper-3 in
        // dark too (ink-500 lands at 4.16:1 there).
        "font-mono text-caption text-ink-600 shadow-[inset_0_-1px_0_rgb(30_28_26/0.06)]",
        className,
      )}
    >
      <span aria-hidden>{glyphs}</span>
      <span className="sr-only">{name}</span>
    </kbd>
  );
}
