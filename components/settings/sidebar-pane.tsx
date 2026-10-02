'use client';
// SETTINGS → SIDEBAR — what lives in your sidebar, and how it behaves.
//
// The user's reference is Linear's Preferences → "App sidebar → Customize":
// visibility per item, in a real settings screen, not only a menu. Zenboard's
// version is organised around the one question a person actually has — "why is
// this in my way / where did that go?" — so every module row says what the
// module HOLDS, in the words they would search with.
//
// It is a VIEW of the shell's state (components/shell/sidebar-prefs.tsx), not a
// copy: flipping a switch here moves the rail beside it in the same frame, and
// the popover at the rail's foot shows the same ticks. Three surfaces, one truth.
//
// ── Deliberate differences from Linear (SPRINT_RULES rule 7) ───────────────
// · NO REORDERING. Linear lets you drag sidebar items. Zenboard's rail is three
//   fixed "hats" (MASTER_PRODUCT_PLAN §6.1 — your day, the work, where you are
//   going); dragging across them would dissolve the grouping that makes the
//   rail scannable, and within a group of two to four rows an order control
//   costs more attention than it returns.
// · NO "SHOW WHEN BADGED". Linear can show an item only while it has something
//   for you. That needs a per-module unread count, which most modules here do
//   not have; a switch that only worked for two of twelve rows would be a lie.
// · SETS. Linear has no presets; Zenboard does, because onboarding already
//   asked who you are, and month six deserves the same one-click answer day one
//   got — plus "Everything", for the person who wants the whole suite back
//   without ticking nine boxes.
import {
  Button, Icon, SegmentedControl, Switch,
  SettingsPaneHeader, SettingsSection, SettingsRow,
} from '@/components/ds/ui';
import { NAV_DEFS, SIDEBAR_MODES } from '@/components/shell/nav-defs';
import { useSidebarPrefs } from '@/components/shell/sidebar-prefs';
import {
  NAV_GROUPS, NAV_MODULES, PRESETS, ROLE_DEFAULTS, matchingPreset, type PresetId,
} from '@/lib/nav-modules';
import type { SidebarMode } from '@/lib/sidebar-mode';

const labelOf = (id: string) => NAV_MODULES.find((m) => m.id === id)?.label ?? id;

/** What a set adds, in words — the row's description. */
function presetSummary(id: PresetId): string {
  if (id === 'everything') return `All ${NAV_MODULES.length} modules.`;
  // Only the EXTRAS: every set includes the four that cannot be switched off,
  // and listing them on every row would bury the one thing that differs.
  return `${ROLE_DEFAULTS[id].map(labelOf).join(', ')}, plus the essentials.`;
}

export function SidebarPane() {
  const prefs = useSidebarPrefs();
  // The pane is meaningless without the shell that owns this state. Every real
  // route renders inside AppShell; this only fires if someone mounts the pane on
  // its own, and silence there would look like a broken screen.
  if (!prefs) throw new Error('SidebarPane must render inside <SidebarPrefsProvider> (AppShell provides it).');

  const current = matchingPreset(prefs.modules);
  const shownCount = NAV_MODULES.filter((m) => prefs.isOn(m.id)).length;

  return (
    <div className="flex flex-col gap-8">
      <SettingsPaneHeader
        title="Sidebar"
        description="What lives in your sidebar, and how it behaves. Hiding a module never deletes anything."
      />

      <SettingsSection title="Behaviour">
        <SettingsRow
          title="Sidebar"
          description="Collapsed keeps a strip of icons. Expand on hover opens it while your pointer is over it."
          control={
            <SegmentedControl
              aria-label="Sidebar behaviour"
              fit="content"
              value={prefs.mode}
              onValueChange={(v) => prefs.setMode(v as SidebarMode)}
              options={SIDEBAR_MODES.map((o) => ({
                value: o.id,
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <Icon icon={o.icon} size={14} />
                    {o.label}
                  </span>
                ),
              }))}
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Start from a set"
        description="Swap your modules for the set that fits how you work. You can change any of them afterwards, and Undo is one click away."
      >
        {PRESETS.map((p) => (
          <SettingsRow
            key={p.id}
            title={p.label}
            description={presetSummary(p.id)}
            // The set you are on reads as a VALUE, not a disabled button: a
            // settings page should state its answers (settings.tsx, "label |
            // value | edit"), and a greyed "Use" beside the current set asks the
            // reader to work out why they cannot press it.
            value={current === p.id ? 'Current' : undefined}
            control={current === p.id ? undefined : (
              <Button size="sm" variant="secondary" onClick={() => prefs.applyPreset(p.id)}>Use</Button>
            )}
          />
        ))}
      </SettingsSection>

      <SettingsSection
        title="Modules"
        description={`${shownCount} of ${NAV_MODULES.length} in your sidebar. A hidden module keeps all its data: its links, pins and search results still work.`}
      >
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="flex flex-col">
            {/* The rail's own grouping, so Finance is under "Work" here exactly as
                it is there. Sentence case, via the one section-label role. */}
            <div className="text-overline pb-1 pt-4 text-ink-500">{g.label}</div>
            {NAV_DEFS.filter((d) => d.group === g.id).map((d) => (
              <SettingsRow
                key={d.id}
                // The module's own glyph, the one it wears in the rail — the row is
                // recognised by its icon before its name is read.
                icon={<Icon icon={d.icon} size={16} />}
                title={d.label}
                description={d.description}
                // THE ESSENTIALS SAY SO. A disabled switch beside Home asks the
                // reader to guess why; "Always on" answers it. These four are the
                // spine a sidebar needs to get you anywhere.
                value={d.core ? 'Always on' : undefined}
                control={d.core ? undefined : (
                  <Switch
                    checked={prefs.isOn(d.id)}
                    onCheckedChange={(v) => prefs.toggle(d.id, v === true)}
                    aria-label={`Show ${d.label} in the sidebar`}
                  />
                )}
              />
            ))}
          </div>
        ))}
      </SettingsSection>
    </div>
  );
}
