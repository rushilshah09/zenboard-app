import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── FIRST RUN ──────────────────────────────────────────────────────────────
//
// Onboarding does not collect facts — it BUILDS the first day: a profile, a project, today's
// tasks with the first one starred, and a day-end time. Two things follow from that, and both
// were wrong before 2026-09-24:
//
// 1. Every step wrote through a server action and read NONE of the answers. These actions RETURN
//    `{ error }` — they do not throw — so a `try/catch` would not have helped either: step 1
//    advanced with no profile saved, `finish()` navigated to a Home with no project and no tasks,
//    and `skip()` could leave `onboarding_complete` unset, which hands the same person the same
//    flow at their next sign-in.
// 2. The screen was a 520px box centred in an empty page — the shape the user had already
//    rejected on the sign-up screen ("looks so boring"), and the reference they sent (Adaline)
//    answers by putting the product beside the form and letting it react to what you type.

const flow = readFileSync('components/onboarding/onboarding-flow.tsx', 'utf8');
const preview = readFileSync('components/onboarding/onboarding-preview.tsx', 'utf8');
const markup = flow.replace(/^\s*\/\/.*$/gm, '').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');

describe('every write is read back', () => {
  it('never advances, navigates or finishes on an unread result', () => {
    // One `await` per write, and each one's result inspected before anything irreversible.
    const writes = [...markup.matchAll(/await (updateProfile|updatePreferences|addProject|addTask)\(/g)].map((m) => m[1]);
    expect(writes.length, 'writes found').toBeGreaterThanOrEqual(5);
    // Nothing is awaited bare: every call site assigns its result.
    expect(markup).not.toMatch(/^\s*await (updateProfile|updatePreferences|addProject|addTask)\(/m);
    // And every one of them is checked.
    expect(markup.match(/'error' in \w+/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('says so when a write fails, and keeps the answers', () => {
    expect(markup).toMatch(/toast\(\{ message: 'Could not save that\. Your answers are still here/);
    expect(markup).toMatch(/toast\(\{ message: 'Could not finish setting up\. Your answers are still here/);
    expect(markup).toMatch(/toast\(\{ message: 'Could not skip just now/);
    // A failure must not leave the button spinning for ever.
    expect(markup).toMatch(/setBusy\(false\)/);
  });

  it('only lands on Home once everything it promised exists', () => {
    const finish = markup.slice(markup.indexOf('async function finish'), markup.indexOf('async function skip'));
    const assign = finish.indexOf("window.location.assign('/today')");
    expect(assign, 'finish navigates').toBeGreaterThan(0);
    // Each guard sits ABOVE the navigation, so a refused write cannot reach it.
    for (const guard of ["if ('error' in p) return fail();", "if ('error' in prefs) return fail();", "if ('error' in done) return fail();"]) {
      expect(finish, guard).toContain(guard);
      expect(finish.indexOf(guard), `${guard} precedes the navigation`).toBeLessThan(assign);
    }
  });
});

describe('the questions sit beside what they build', () => {
  it('is a split, with the preview dropping away on a phone', () => {
    expect(markup).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.05fr\)\]/);
    expect(markup).toMatch(/<OnboardingPreview state=\{preview\} \/>/);
    expect(preview).toMatch(/hidden[^"]*lg:flex/);
  });

  it('draws the preview with the app’s own components, inert', () => {
    for (const part of ['<Panel frame="shadow">', '<PanelHeader', '<PanelBody>', '<Checkbox']) {
      expect(preview, part).toContain(part);
    }
    expect(preview).toMatch(/<aside aria-hidden/);
    expect(preview).toMatch(/pointer-events-none/);
    expect(preview).toMatch(/tabIndex=\{-1\}/);
  });

  it('shows what the answers will really produce', () => {
    // The first task is the highlight — which is exactly what `finish()` writes — and the project
    // rides along on every row, as it will on Home.
    expect(preview).toMatch(/i === 0 && <Icon icon=\{Star\}/);
    expect(markup).toMatch(/highlight: i === 0/);
    expect(preview).toMatch(/projectName\.trim\(\) && \(/);
    // The shutdown card appears on the step that asks for it, not before.
    expect(preview).toMatch(/\{step >= 2 && \(/);
  });

  it('never reads the clock while rendering', () => {
    // A greeting computed in render disagrees between the server and the browser and React throws
    // the tree away — this preview blanked the page exactly that way. The hour is a prop, as it is
    // for Home.
    expect(preview).not.toMatch(/new Date\(\)/);
    expect(preview).toMatch(/nowHour\?: number/);
    expect(readFileSync('app/onboarding/page.tsx', 'utf8')).toMatch(/nowHour=\{new Date\(\)\.getHours\(\)\}/);
  });

  it('says how far along you are, in words', () => {
    expect(markup).toMatch(/\{step \+ 1\} of \{TOTAL\}/);
    expect(markup).toMatch(/aria-label=\{`Step \$\{step \+ 1\} of \$\{TOTAL\}`\}/);
  });
});
