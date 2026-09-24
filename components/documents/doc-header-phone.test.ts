import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// At 375px the Documents header lane held Filter 89 + layout 76 + Import 82 +
// New doc 98 in 357px, and the lane clips — "+ New doc", the page's one verb,
// lost its right edge. The rule: secondary controls give up their words first,
// the verb keeps its own. Driven by the page's existing `headerTight` (the lane
// sizes to its content, so it cannot be a query container without collapsing).
const src = readFileSync('components/documents/documents-view.tsx', 'utf8');

describe('the Documents header on a phone', () => {
  it('turns Filter and Import into named icon buttons when the header is tight', () => {
    expect(src.match(/iconOnly=\{headerTight\}/g) ?? [], 'Filter and Import').toHaveLength(2);
    expect(src, 'Filter keeps its name, including an active tag').toMatch(/aria-label=\{headerTight \? \(tagFilter \? `Filter: \$\{tagFilter\}` : 'Filter'\) : undefined\}/);
    expect(src, 'Import keeps its name').toMatch(/aria-label=\{headerTight \? 'Import' : undefined\}/);
  });

  it('never takes the verb\'s word away', () => {
    const verb = src.slice(src.indexOf('onClick={createHere}') - 160, src.indexOf('onClick={createHere}') + 60);
    expect(verb, 'the create button is found').toMatch(/createLabel/);
    expect(verb).not.toMatch(/iconOnly/);
  });
});
