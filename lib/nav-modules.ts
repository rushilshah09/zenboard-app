// WHICH MODULES THIS PERSON ACTUALLY USES.
//
// ── The problem this exists to solve ──────────────────────────────────────
// Zenboard shipped twelve nav destinations to everyone, from minute one, all
// empty. Onboarding asks "What brings you here?" — Freelancer / Founder /
// Individual — writes the answer to `profiles.role`, and then (measured
// 2026-09-30) NOTHING in the codebase ever reads it again except one line
// deciding whether to show an hourly-rate field. So somebody who told us they
// were here for "personal focus & habits" got Clients, Finance, Forms,
// Messages and Content in their sidebar forever, and there was no mechanism to
// turn any of them off — the "Sidebar control" popover only sets the rail's
// WIDTH.
//
// A suite with twelve front doors has no spine, and that is upstream of most of
// what reads as unfinished: no screen can have one obvious action when the
// product itself has twelve.
//
// ── The rule ─────────────────────────────────────────────────────────────
// FOUR modules are the spine and cannot be switched off. Everything else is
// opt-in, seeded from the role at the end of onboarding and editable forever
// after. Hiding is a NAV decision only: every route, link, pin, ⌘K entry and
// deep link keeps working, because a module you turned off last month still
// owns the invoice somebody just emailed you a link to.
//
// ── Why absence means "show everything" ──────────────────────────────────
// `readEnabledModules` returns null when the key has never been written, and
// every caller treats null as ALL. That is deliberate and it is the whole
// migration story: accounts that onboarded before this existed have no key, so
// they see exactly what they saw yesterday. Only new accounts — which write the
// key on their way out of onboarding — get a tailored shape. No backfill, no
// migration, and nobody logs in one morning to find six modules missing.

export type ProfileRole = 'individual' | 'freelancer' | 'founder';

/** The jsonb key inside `profiles.preferences`. Same home as pins and the
 *  timezone, for the same reason: it is per-account UI state, not a table. */
export const NAV_MODULES_KEY = 'navModules';

/** The rail's three groups (MASTER_PRODUCT_PLAN §6.1: "hat-shaped" — the day,
 *  the work, where you are going). Settings mirrors them, so a person looking for
 *  Finance finds it under the same heading in both places. */
export const NAV_GROUPS = [
  { id: 'day', label: 'Your day' },
  { id: 'work', label: 'Work' },
  { id: 'direction', label: 'Direction' },
] as const;
export type NavGroupId = (typeof NAV_GROUPS)[number]['id'];

/**
 * Every switchable module, in sidebar order. `core` cannot be turned off.
 *
 * ONE catalogue. The description is here, not in the settings pane, because it
 * is the same fact the rail's tooltip and the pane's row both need, and a second
 * list of twelve is how "Finance" and "Money" ended up as two names for one
 * module before (see CLAUDE.md's glossary). Plain strings only — no React — so
 * the server layout and the tests can import this file.
 *
 * Descriptions say what the module HOLDS, in the words a person would search
 * with. No slogans (CLAUDE.md: "no poetry in UI copy").
 */
export const NAV_MODULES = [
  { id: 'today', label: 'Home', core: true, group: 'day', description: 'Your plan for today, and what is waiting on other people.' },
  { id: 'tasks', label: 'Tasks', core: true, group: 'day', description: 'Everything you have to do, in lists and projects.' },
  { id: 'calendar', label: 'Calendar', core: true, group: 'day', description: 'Your schedule, with time held for the work.' },
  { id: 'projects', label: 'Projects', core: false, group: 'work', description: 'Client work, with milestones, time and a client portal.' },
  { id: 'clients', label: 'Clients', core: false, group: 'work', description: 'Who you work with, and the leads in your pipeline.' },
  { id: 'messages', label: 'Messages', core: false, group: 'work', description: 'A conversation for each project, shared with the client.' },
  { id: 'forms', label: 'Forms', core: false, group: 'work', description: 'Briefs and feedback forms anyone can fill in, no account needed.' },
  { id: 'content', label: 'Content', core: false, group: 'work', description: 'Your own posts and videos, from first idea to published.' },
  { id: 'documents', label: 'Docs', core: true, group: 'work', description: 'Notes, briefs and databases.' },
  { id: 'money', label: 'Finance', core: false, group: 'work', description: 'Invoices, payments and what you are owed.' },
  { id: 'horizon', label: 'Goals', core: false, group: 'direction', description: 'Outcomes for the month, the quarter and the year.' },
  { id: 'habits', label: 'Habits', core: false, group: 'direction', description: 'Small things you repeat, on the days you choose.' },
] as const;

export type NavModuleId = (typeof NAV_MODULES)[number]['id'];

const ALL_IDS: readonly string[] = NAV_MODULES.map((m) => m.id);
export const CORE_IDS: readonly string[] = NAV_MODULES.filter((m) => m.core).map((m) => m.id);

/**
 * What each role starts with, on top of the core four.
 *
 * The principle is WEEK ONE, not "everything you might ever want". Messages
 * (a conversation per project), Forms (client intake) and Content (the studio's
 * own output) are all real features, and all of them are week-four features:
 * they need projects and clients to exist before they mean anything. Starting
 * them off is not hiding them — the sidebar's "Show more" lists every one, and
 * turning one on is a click that persists.
 *
 * These three lines are the product's opinion about each kind of person, and
 * they are meant to be argued with. Change the arrays; nothing else moves.
 */
export const ROLE_DEFAULTS: Record<ProfileRole, readonly NavModuleId[]> = {
  // Runs client work single-handed: the job is projects → invoices.
  freelancer: ['projects', 'clients', 'money'],
  // Same, plus where the company is going.
  founder: ['projects', 'clients', 'money', 'horizon'],
  // No clients, no invoices. Their whole product is the day and the streak.
  individual: ['horizon', 'habits'],
};

/**
 * The sets Settings offers under "Start from a set". The three roles are the
 * same arrays onboarding seeds from — one definition, so "Use the Freelancer
 * set" in month six gives exactly what a new freelancer got on day one.
 * `everything` is the fourth door: the person who wants the whole suite should
 * not have to tick nine boxes to get it.
 */
export const PRESETS = [
  { id: 'freelancer', label: 'Freelancer' },
  { id: 'founder', label: 'Founder' },
  { id: 'individual', label: 'Individual' },
  { id: 'everything', label: 'Everything' },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];

export function presetModules(id: PresetId): string[] {
  return id === 'everything' ? [...ALL_IDS] : defaultModulesForRole(id);
}

/** The preset the current set is exactly equal to, or null for a custom set. */
export function matchingPreset(current: readonly string[] | null): PresetId | null {
  // Unconfigured renders as everything, so it IS the everything preset — and
  // saying "Custom" to someone who never changed anything would be a lie.
  const have = new Set(current ?? ALL_IDS);
  for (const p of PRESETS) {
    const want = presetModules(p.id);
    if (want.length === have.size && want.every((id) => have.has(id))) return p.id;
  }
  return null;
}

/** The set a brand-new account of this role starts with (core + its defaults). */
export function defaultModulesForRole(role: ProfileRole | null | undefined): string[] {
  const extras = role ? ROLE_DEFAULTS[role] ?? [] : ROLE_DEFAULTS.freelancer;
  // Emitted in sidebar order rather than core-then-extras, so the stored value
  // reads the way the rail does and a diff between two accounts is legible.
  const on = new Set<string>([...CORE_IDS, ...extras]);
  return ALL_IDS.filter((id) => on.has(id));
}

/**
 * The enabled set for an account, or `null` when it has never been configured.
 *
 * null is NOT "none" and must never be rendered as an empty sidebar — it means
 * "this account predates the setting", and every caller shows all modules. The
 * distinction is the reason this returns a nullable instead of defaulting
 * internally: a helper that quietly returned the freelancer shape here would
 * have hidden Habits from every existing individual on the day it shipped.
 */
export function readEnabledModules(preferences: unknown): string[] | null {
  const prefs = preferences as Record<string, unknown> | null | undefined;
  const raw = prefs?.[NAV_MODULES_KEY];
  if (!Array.isArray(raw)) return null;

  const stored = new Set(raw.filter((v): v is string => typeof v === 'string'));
  // Core is merged in rather than trusted from storage: an older stored value,
  // a hand-edited row, or a module PROMOTED to core later must never be able to
  // produce a sidebar with no way home.
  for (const id of CORE_IDS) stored.add(id);
  // Unknown ids are dropped — a module that was renamed or removed leaves a
  // stale string behind, and a nav that renders ids it cannot resolve is how a
  // deleted feature comes back as a dead row.
  return ALL_IDS.filter((id) => stored.has(id));
}

/** Enabled ids for rendering: the stored set, or every module when unset. */
export function enabledModuleIds(preferences: unknown): string[] {
  return readEnabledModules(preferences) ?? [...ALL_IDS];
}

/** The switched-off ones, for the "Show more" list. Empty when unconfigured. */
export function hiddenModuleIds(preferences: unknown): string[] {
  const on = new Set(enabledModuleIds(preferences));
  return ALL_IDS.filter((id) => !on.has(id));
}

/** Toggle one module, returning the value to persist. Core cannot be removed. */
export function toggleModule(current: readonly string[], id: string, on: boolean): string[] {
  const next = new Set(current);
  if (on) next.add(id);
  else if (!CORE_IDS.includes(id)) next.delete(id);
  for (const core of CORE_IDS) next.add(core);
  return ALL_IDS.filter((m) => next.has(m));
}
