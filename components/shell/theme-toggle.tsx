'use client';
// The appearance control in the sidebar account menu.
//
// It used to be a hand-rolled <button> that flipped light↔dark — and it drew a
// ChevronRight, the universal "this opens a submenu" affordance, next to a row
// that opened nothing. It also hand-rolled its own hover with React state and
// its own padding/type/icon sizes, so it did not match the DS `MenuItem`s
// directly above it in the same menu.
//
// It is now a Radix submenu through the DS wrapper, which makes the chevron
// honest, inherits the shared panel/row chrome verbatim, and comes with
// keyboard navigation, the safe triangle, and focus management for free.
//
// Three options, not two: `Theme` in lib/theme.ts has always been
// 'light' | 'dark' | 'system' — the boot script and `resolveTheme` both handle
// it — but the sidebar never offered 'system', so the only way back to
// following the OS was to clear localStorage. See [[zenboard-theme-bridge]].
import { useEffect, useState } from 'react';
import { Sun, Moon, Desktop } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui/icon';
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ds/ui/dropdown-menu';
import { APPEARANCE_EVENT, commitAppearance, readAppearance, type Theme } from '@/lib/theme';
import { useResolvedTheme } from '@/lib/use-resolved-theme';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Desktop },
];

export function ThemeToggleItem() {
  // `null` until mounted: localStorage is not readable during SSR, and guessing
  // would render the wrong radio for one frame.
  const [theme, setTheme] = useState<Theme | null>(null);
  // What the reader is LOOKING at — the one reader, shared with the form captcha.
  const resolved = useResolvedTheme();

  useEffect(() => {
    const sync = () => setTheme(readAppearance().theme);
    sync();
    // Fires for our own commits AND for an OS flip while 'system' is chosen.
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_EVENT, sync);
  }, []);

  return (
    <DropdownMenuSub>
      {/* The glyph shows what the user is LOOKING at (the resolved theme), while
          the radio below shows what they CHOSE — the two differ under 'system'. */}
      <DropdownMenuSubTrigger icon={<Icon icon={resolved === 'dark' ? Moon : Sun} size={16} />}>
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={theme ?? undefined}
          onValueChange={(v) => commitAppearance({ theme: v as Theme })}
        >
          {OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <Icon icon={o.icon} size={16} />
              <span className="flex-1 truncate">{o.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
