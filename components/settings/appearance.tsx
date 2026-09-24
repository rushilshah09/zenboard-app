'use client';
// Appearance — theme (Light/Dark/System), density, accent, page width, and the
// task sound.
// Per-device, stored in localStorage and applied to <html> live; the boot script
// in layout.tsx applies the same values before paint. Rendered as DS settings
// rows: label + quiet description left, the control on the trailing edge.
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, FileText, Palette, type IconType } from "@/components/ds/icons";
import {
  Icon, SegmentedControl, Switch,
  SettingsPaneHeader, SettingsSection, SettingsRow,
} from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { useViewWidth } from '@/components/shell/view-width';
import { taskSoundEnabled, setTaskSoundEnabled, SOUND_EVENT, playTaskComplete } from '@/lib/sound';
import {
  type Theme, type Density, type Accent, type Skin,
  DEFAULT_THEME, DEFAULT_DENSITY, DEFAULT_ACCENT, DEFAULT_SKIN, ACCENTS,
  APPEARANCE_EVENT, readAppearance, commitAppearance, applyAppearance,
} from '@/lib/theme';

type Opt<T> = { value: T; label: string; icon?: IconType };

const THEME_OPTS: Opt<Theme>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];
// The two things the app can be MADE OF. Light/dark is how bright the default
// skin is; this is the material.
const SKIN_OPTS: Opt<Skin>[] = [
  { value: 'default', label: 'Default', icon: Palette },
  { value: 'paper', label: 'Paper', icon: FileText },
];
const DENSITY_OPTS: Opt<Density>[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

function segmentedOptions<T extends string>(opts: Opt<T>[]) {
  return opts.map((o) => ({
    value: o.value,
    label: (
      <span className="flex items-center justify-center gap-1.5">
        {o.icon && <Icon icon={o.icon} size={14} />}
        {o.label}
      </span>
    ),
  }));
}

export function Appearance() {
  // Start from defaults (matches SSR, no flash — the boot script already applied
  // the real values), then mirror the stored prefs once mounted.
  const [pref, setPref] = useState({ theme: DEFAULT_THEME as Theme, density: DEFAULT_DENSITY as Density, accent: DEFAULT_ACCENT as Accent, skin: DEFAULT_SKIN as Skin });
  const { theme, density, accent, skin } = pref;

  // Sync from the source of truth on mount and whenever any surface changes it
  // (e.g. the sidebar quick-toggle) so the controls never drift out of sync.
  useEffect(() => {
    const sync = () => setPref(readAppearance());
    sync();
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_EVENT, sync);
  }, []);

  // When following the OS, re-resolve light/dark as it flips.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyAppearance('system', density, accent, skin);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme, density, accent, skin]);

  // Each control patches one field; commitAppearance reads the others fresh from
  // localStorage, so rapid clicks can't clobber each other.
  const setTheme = (t: Theme) => setPref(commitAppearance({ theme: t }));
  const setDensity = (d: Density) => setPref(commitAppearance({ density: d }));
  const setAccent = (a: Accent) => setPref(commitAppearance({ accent: a }));
  const setSkin = (k: Skin) => setPref(commitAppearance({ skin: k }));

  const paper = skin === 'paper';

  // Page width — the same device-local preference the ••• page menu used to own.
  const { full, toggle } = useViewWidth();

  // Task-completion sound — a separate device-local preference (default on).
  const [sound, setSound] = useState(true);
  useEffect(() => {
    const sync = () => setSound(taskSoundEnabled());
    sync();
    window.addEventListener(SOUND_EVENT, sync);
    return () => window.removeEventListener(SOUND_EVENT, sync);
  }, []);
  const toggleSound = (next: boolean) => {
    setSound(next);
    setTaskSoundEnabled(next);
    if (next) playTaskComplete(); // preview the cue when turning it on
  };

  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Appearance" description="How Zenboard looks and sounds on this device." />

      <SettingsSection title="Theme">
        <SettingsRow
          title="Theme"
          description="Default is the screen palette. Paper prints the whole app on stock, with ink rules and square corners."
          control={
            <SegmentedControl
              aria-label="Theme"
              fit="content"
              value={skin}
              onValueChange={(v) => setSkin(v as Skin)}
              options={segmentedOptions(SKIN_OPTS)}
            />
          }
        />
        {/* Light/dark belongs to the default skin: paper is a light material, and a
            dark paper is a different material. Rather than leave a control that
            silently does nothing, the row says so. */}
        <SettingsRow
          title="Light and dark"
          description={paper ? 'Paper is a light material — light and dark apply to the default theme.' : 'Light, dark, or match your system.'}
          control={
            <SegmentedControl
              aria-label="Light and dark"
              fit="content"
              value={theme}
              onValueChange={(v) => setTheme(v as Theme)}
              options={segmentedOptions(THEME_OPTS).map((o) => ({ ...o, disabled: paper }))}
            />
          }
        />
        <SettingsRow
          title="Density"
          description="Tighter spacing fits more on screen."
          control={
            <SegmentedControl
              aria-label="Density"
              fit="content"
              value={density}
              onValueChange={(v) => setDensity(v as Density)}
              options={segmentedOptions(DENSITY_OPTS)}
            />
          }
        />
        <SettingsRow
          title="Accent"
          description="The highlight color used across the app."
          control={
            <div role="radiogroup" aria-label="Accent color" className="flex items-center gap-2">
              {ACCENTS.map((a) => {
                const on = a.id === accent;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={a.label}
                    title={a.label}
                    onClick={() => setAccent(a.id)}
                    className={cn(
                      "focus-ring size-7 shrink-0 rounded-full transition-shadow duration-fast",
                      on
                        ? "shadow-[0_0_0_2px_var(--color-surface-panel),0_0_0_4px_var(--color-ink-700)]"
                        : "shadow-[inset_0_0_0_1px_var(--color-line)]",
                    )}
                    style={{ background: a.hex }}
                  />
                );
              })}
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="Layout">
        {/* Full width used to be the ONLY item in a ••• menu rendered on every
            page header — a permanent overflow button, in the most valuable slot
            on the row, holding one device-wide preference. It belongs with the
            other device preferences; the page headers end with the page's own
            action now. */}
        <SettingsRow
          title="Full width"
          description="Let pages use the whole workspace instead of a centred reading column."
          control={<Switch checked={full} onCheckedChange={toggle} aria-label="Full width" />}
        />
      </SettingsSection>

      <SettingsSection title="Sound">
        <SettingsRow
          title="Task completion sound"
          description="A subtle chime when you complete a task."
          control={<Switch checked={sound} onCheckedChange={toggleSound} aria-label="Task completion sound" />}
        />
      </SettingsSection>

      <p className="text-meta text-ink-500">Saved on this device.</p>
    </div>
  );
}
