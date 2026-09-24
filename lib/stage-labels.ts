// Renaming a pipeline stage.
//
// ── WHAT IS AND IS NOT RENAMEABLE ───────────────────────────────────────────
// The stage's NAME, never its id. `idea`, `script`, `shoot`, `edit`, `review`,
// `scheduled`, `published` are not decoration: `isSettled` decides what counts
// as finished, `stagesFor` decides which columns a format even passes through,
// `STAGE_ACTION` says what to do next, `board()` sorts `published` backwards
// because it is an archive, and `landingIndex` reads all of it. A studio that
// calls its edit stage "The cut" is naming the same step in the same process —
// so the id stays and only the label moves, and every one of those rules keeps
// working untouched.
//
// That is also why this is a LABEL MAP and not a table of user-defined stages.
// Arbitrary stages would mean no `isSettled`, no format routing, and no next
// action — a far larger thing than the ask, and a worse product: the pipeline's
// meaning is what makes the board able to tell you anything.
//
// ── WHERE IT LIVES ──────────────────────────────────────────────────────────
// `profiles.preferences`, the same place the property layout lives, for the same
// reason: it is one person's view of a shared thing, needs no history, and needs
// no migration. See lib/property-layout.ts.
import { STAGES, STAGE_LABEL, type Stage } from '@/lib/content';

/** Long enough for "Waiting on client", short enough for a 300px column head. */
export const STAGE_NAME_MAX = 22;

/** Only the stages someone actually renamed. Absent ⇒ the default. */
export type StageLabels = Partial<Record<Stage, string>>;

const KEY = 'contentStageLabels';
const IS_STAGE = new Set<string>(STAGES);

/**
 * Read the map out of a profile's preferences.
 *
 * EVERY KEY AND VALUE IS NORMALISED, because this is JSON with no database to
 * reject it — the same lesson `lib/properties.ts` and `readContent` both learned.
 * A label stored under a stage that no longer exists, or a label that is a
 * number, must not reach a column header.
 */
export function readStageLabels(preferences: unknown): StageLabels {
  const root = (preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? preferences : {}) as Record<string, unknown>;
  const raw = (root[KEY] && typeof root[KEY] === 'object' && !Array.isArray(root[KEY])
    ? root[KEY] : {}) as Record<string, unknown>;
  const out: StageLabels = {};
  for (const [stage, value] of Object.entries(raw)) {
    if (!IS_STAGE.has(stage)) continue;
    const name = typeof value === 'string' ? value.trim().slice(0, STAGE_NAME_MAX) : '';
    // A stored blank is not a nameless column; it is no override at all.
    if (!name || name === STAGE_LABEL[stage as Stage]) continue;
    out[stage as Stage] = name;
  }
  return out;
}

/** The shape to merge into `preferences`. */
export function writeStageLabels(labels: StageLabels): Record<string, unknown> {
  return { [KEY]: labels };
}

/** What this stage is called, for this person. The one reader every surface uses. */
export function stageName(labels: StageLabels, stage: Stage): string {
  return labels[stage] ?? STAGE_LABEL[stage];
}

/**
 * A typed name, ready to store — or `null` meaning "put the default back".
 *
 * Emptying the field is how you undo a rename. There is no separate reset
 * button for it because clearing a name and asking for the default back are the
 * same intention, and a name typed back to exactly the default is stored as no
 * override rather than as a copy of it — otherwise a later change to the
 * default silently would not reach the people who had "kept" it.
 */
export function normalizeStageName(raw: string, stage: Stage): string | null {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, STAGE_NAME_MAX);
  if (!name || name === STAGE_LABEL[stage]) return null;
  return name;
}

/** Apply one rename, returning the whole map — the value being edited is the map. */
export function withStageName(labels: StageLabels, stage: Stage, name: string | null): StageLabels {
  const next = { ...labels };
  if (name === null) delete next[stage];
  else next[stage] = name;
  return next;
}
