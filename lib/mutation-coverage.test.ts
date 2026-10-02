import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE REGISTRY IS NOT THE FEATURE. `lib/mutation-actions.ts` registered six
// kinds, but for a long while only ONE (`task.toggle`) was ever pushed — the
// other five were infrastructure nobody reached, so those edits still awaited
// the server and were lost if the tab closed inside the round trip. Nothing
// failed; the queue just sat half-used and looked finished.
//
// These assertions make that visible: a kind that is registered but never
// pushed is dead code, and a queued edit that also awaits its action is the old
// behaviour creeping back.
const registry = readFileSync('lib/mutation-actions.ts', 'utf8');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith('.tsx') || (p.endsWith('.ts') && !p.endsWith('.test.ts'))) out.push(p);
  }
  return out;
}
const sources = tsxFiles('components').map((f) => ({ file: f, src: readFileSync(f, 'utf8') }));

/** The kinds declared in ACTIONS, read from the registry itself. */
const REGISTERED = [...registry.matchAll(/^\s*'([a-z]+\.[a-zA-Z]+)':/gm)].map((m) => m[1]);

describe('mutation queue coverage', () => {
  it('the registry declares the kinds this test expects to find', () => {
    // A sanity check on the parse — if the registry's shape changes, the
    // assertions below would silently pass over an empty list.
    expect(REGISTERED.length, 'parsed no kinds out of the registry').toBeGreaterThanOrEqual(6);
    expect(REGISTERED).toContain('task.toggle');
  });

  it.each(REGISTERED)('%s is actually pushed by a component, not just registered', (kind) => {
    const used = sources.some(({ src }) => src.includes(`kind: '${kind}'`));
    expect(used, `${kind} is registered but never queued — it is dead infrastructure, and the edit it names is still awaiting the server`).toBe(true);
  });

  it('a queued edit does not also await its own server action', () => {
    // The two paths together would write twice and defeat the point: the queue
    // exists so the caller returns immediately.
    const awaited: string[] = [];
    for (const { file, src } of sources) {
      // Look inside each function that queues something.
      for (const m of src.matchAll(/kind: '([a-z]+\.[a-zA-Z]+)'/g)) {
        const start = Math.max(0, src.lastIndexOf('function ', m.index!));
        const body = src.slice(start, m.index!);
        if (/\bconst res = await (setHighlight|rescheduleTask|toggleTask|updateTask|moveTaskToProject|setTaskList)\(/.test(body)) {
          awaited.push(`${file}: ${m[1]}`);
        }
      }
    }
    expect(awaited, 'these queue AND await — pick one').toEqual([]);
  });
});
