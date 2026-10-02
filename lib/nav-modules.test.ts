import { describe, it, expect } from 'vitest';
import {
  NAV_MODULES, NAV_GROUPS, CORE_IDS, ROLE_DEFAULTS, NAV_MODULES_KEY, PRESETS,
  defaultModulesForRole, readEnabledModules, enabledModuleIds, hiddenModuleIds, toggleModule,
  presetModules, matchingPreset,
} from './nav-modules';

// The rule this file exists to hold: a sidebar can always get you home, and an
// account that predates the setting never loses a module.
describe('nav modules', () => {
  it('reads the catalogue it guards (control)', () => {
    // A test that silently found no modules would pass every assertion below.
    expect(NAV_MODULES.length).toBeGreaterThan(8);
    expect(CORE_IDS).toContain('today');
    expect(CORE_IDS).not.toContain('money');
  });

  describe('an unconfigured account keeps everything', () => {
    // This is the whole migration story. If it breaks, every account that
    // onboarded before this shipped loses modules on next login.
    it('returns null — never an empty set — when the key is absent', () => {
      expect(readEnabledModules(undefined)).toBeNull();
      expect(readEnabledModules(null)).toBeNull();
      expect(readEnabledModules({})).toBeNull();
      expect(readEnabledModules({ timezone: 'Asia/Kolkata', pins: [] })).toBeNull();
    });

    it('renders as ALL modules, matching what those accounts saw yesterday', () => {
      expect(enabledModuleIds({})).toEqual(NAV_MODULES.map((m) => m.id));
      expect(hiddenModuleIds({})).toEqual([]);
    });

    it('a non-array value is treated as unconfigured, not as a crash', () => {
      expect(readEnabledModules({ [NAV_MODULES_KEY]: 'tasks' })).toBeNull();
      expect(readEnabledModules({ [NAV_MODULES_KEY]: 42 })).toBeNull();
    });
  });

  describe('a configured account', () => {
    it('keeps only what it stored, in sidebar order', () => {
      const prefs = { [NAV_MODULES_KEY]: ['money', 'tasks', 'projects'] };
      // Sidebar order, not stored order — the rail reads top to bottom.
      expect(enabledModuleIds(prefs)).toEqual(['today', 'tasks', 'calendar', 'projects', 'documents', 'money']);
    });

    it('can never lose a core module, however the row was written', () => {
      // A hand-edited row, an older client, or a module promoted to core later.
      const stripped = readEnabledModules({ [NAV_MODULES_KEY]: ['money'] })!;
      for (const core of CORE_IDS) expect(stripped, `${core} survives`).toContain(core);
    });

    it('drops ids the catalogue no longer has', () => {
      // A renamed or deleted module leaves a stale string behind; a nav that
      // renders unresolvable ids is how a removed feature returns as a dead row.
      const got = readEnabledModules({ [NAV_MODULES_KEY]: ['tasks', 'rituals', 'library', 'memory'] })!;
      expect(got).not.toContain('rituals');
      expect(got).not.toContain('library');
    });

    it('splits cleanly into shown and hidden', () => {
      const prefs = { [NAV_MODULES_KEY]: defaultModulesForRole('individual') };
      const shown = enabledModuleIds(prefs);
      const hidden = hiddenModuleIds(prefs);
      expect([...shown, ...hidden].sort()).toEqual(NAV_MODULES.map((m) => m.id).sort());
      expect(shown.filter((id) => hidden.includes(id))).toEqual([]);
    });
  });

  describe('role seeding', () => {
    it('gives every role the core spine', () => {
      for (const role of ['freelancer', 'founder', 'individual'] as const) {
        const got = defaultModulesForRole(role);
        for (const core of CORE_IDS) expect(got, `${role} keeps ${core}`).toContain(core);
      }
    });

    it('answers the question onboarding actually asked', () => {
      // The point of the whole file: somebody who said "personal focus & habits"
      // must not be handed Clients, Finance and Forms.
      const individual = defaultModulesForRole('individual');
      expect(individual).toContain('habits');
      expect(individual).not.toContain('clients');
      expect(individual).not.toContain('money');
      expect(individual).not.toContain('forms');

      const freelancer = defaultModulesForRole('freelancer');
      expect(freelancer).toContain('clients');
      expect(freelancer).toContain('money');
      expect(freelancer).not.toContain('habits');
    });

    it('starts every role smaller than the twelve-module suite', () => {
      for (const role of ['freelancer', 'founder', 'individual'] as const) {
        expect(defaultModulesForRole(role).length, role).toBeLessThan(NAV_MODULES.length);
      }
    });

    it('seeds a missing role rather than emitting an empty rail', () => {
      expect(defaultModulesForRole(null).length).toBeGreaterThanOrEqual(CORE_IDS.length);
      expect(defaultModulesForRole(undefined)).toEqual(defaultModulesForRole('freelancer'));
    });

    it('every default names a real module (control)', () => {
      const ids = new Set(NAV_MODULES.map((m) => m.id));
      for (const [role, extras] of Object.entries(ROLE_DEFAULTS)) {
        for (const id of extras) expect(ids.has(id), `${role} -> ${id}`).toBe(true);
      }
    });
  });

  describe('toggling', () => {
    it('adds and removes an optional module', () => {
      const base = defaultModulesForRole('individual');
      const withForms = toggleModule(base, 'forms', true);
      expect(withForms).toContain('forms');
      expect(toggleModule(withForms, 'forms', false)).not.toContain('forms');
    });

    it('refuses to remove a core module', () => {
      const base = defaultModulesForRole('freelancer');
      expect(toggleModule(base, 'tasks', false)).toContain('tasks');
    });

    it('is idempotent and stays in sidebar order', () => {
      const once = toggleModule(defaultModulesForRole('individual'), 'content', true);
      expect(toggleModule(once, 'content', true)).toEqual(once);
      const order = NAV_MODULES.map((m) => m.id);
      expect(once).toEqual(order.filter((id) => once.includes(id)));
    });
  });

  describe('the catalogue settings reads', () => {
    it('gives every module a group the rail knows, and a real description', () => {
      const groups = new Set(NAV_GROUPS.map((g) => g.id));
      for (const m of NAV_MODULES) {
        expect(groups.has(m.group), `${m.id} -> ${m.group}`).toBe(true);
        // A sentence, not a slogan: long enough to say what the module holds.
        expect(m.description.length, m.id).toBeGreaterThan(20);
        expect(m.description.endsWith('.'), `${m.id} ends as a sentence`).toBe(true);
      }
    });

    it('keeps every group non-empty, so no settings heading sits over nothing', () => {
      for (const g of NAV_GROUPS) {
        expect(NAV_MODULES.filter((m) => m.group === g.id).length, g.id).toBeGreaterThan(0);
      }
    });
  });

  describe('presets', () => {
    it('are the SAME sets onboarding seeds — one definition, not two', () => {
      for (const role of ['freelancer', 'founder', 'individual'] as const) {
        expect(presetModules(role)).toEqual(defaultModulesForRole(role));
      }
      expect(presetModules('everything')).toEqual(NAV_MODULES.map((m) => m.id));
    });

    it('recognises the set you are on', () => {
      for (const p of PRESETS) expect(matchingPreset(presetModules(p.id)), p.id).toBe(p.id);
    });

    it('calls an untouched account Everything, never Custom', () => {
      // null renders as all twelve; telling somebody who never changed a thing
      // that they have a "custom" sidebar would be a lie about their own setup.
      expect(matchingPreset(null)).toBe('everything');
    });

    it('calls a hand-edited set custom (null)', () => {
      const mixed = toggleModule(presetModules('freelancer'), 'habits', true);
      expect(matchingPreset(mixed)).toBeNull();
    });

    it('is order-insensitive', () => {
      const shuffled = [...presetModules('founder')].reverse();
      expect(matchingPreset(shuffled)).toBe('founder');
    });
  });
});
