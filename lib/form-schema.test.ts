import { describe, it, expect } from 'vitest';
import {
  emptyBlock, starterBlocks, toFormContent, toFormSettings,
  validateAnswer, validateAll, answerToText, isField, hasOptions,
  visibleBlocks, isBlockVisible, conditionSentence, visibleFieldIds,
  type FormBlock,
} from './form-schema';
import { FORM_TEMPLATES, instantiate, templateByKey } from './form-templates';

const field = (over: Partial<FormBlock> = {}): FormBlock => ({ id: 'q1', type: 'short_text', label: 'Q', ...over });

describe('block construction', () => {
  it('gives choice blocks starter options and text blocks none', () => {
    expect(emptyBlock('select').options).toEqual(['Option 1', 'Option 2']);
    expect(emptyBlock('short_text').options).toBeUndefined();
  });

  it('leaves phone optional by default (the abandonment fix)', () => {
    expect(emptyBlock('phone').required).toBeUndefined();
    expect(emptyBlock('short_text').required).toBe(false);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => emptyBlock('short_text').id));
    expect(ids.size).toBe(50);
  });

  it('opens a new form with three usable starter questions', () => {
    const blocks = starterBlocks();
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => isField(b.type))).toBe(true);
  });

  it('knows which types carry options', () => {
    expect(hasOptions('multi_select')).toBe(true);
    expect(hasOptions('rating')).toBe(false);
  });
});

describe('toFormContent — defensive parse of untrusted jsonb', () => {
  it('degrades to an empty form rather than throwing', () => {
    expect(toFormContent(null).blocks).toEqual([]);
    expect(toFormContent('nonsense').blocks).toEqual([]);
    expect(toFormContent({}).blocks).toEqual([]);
    expect(toFormContent({ blocks: 'no' }).blocks).toEqual([]);
  });

  it('drops malformed blocks but keeps valid siblings', () => {
    const parsed = toFormContent({
      blocks: [
        { id: 'a', type: 'short_text', label: 'Keep me' },
        { id: 'b', type: 'not_a_real_type', label: 'Drop me' },
        { type: 'email', label: 'No id — drop' },
        null,
        { id: 'c', type: 'email', label: 'Keep me too' },
      ],
    });
    expect(parsed.blocks.map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('strips unknown properties and keeps only string options', () => {
    const parsed = toFormContent({
      blocks: [{ id: 'a', type: 'select', label: 'Pick', options: ['x', 3, null, 'y'], evil: 'payload' }],
    });
    expect(parsed.blocks[0].options).toEqual(['x', 'y']);
    expect('evil' in parsed.blocks[0]).toBe(false);
  });
});

describe('toFormSettings', () => {
  it('defaults to page mode and safe values', () => {
    const s = toFormSettings(undefined);
    expect(s.mode).toBe('page');
    expect(s.collectIdentity).toBe(false);
    expect(s.limit).toBeNull();
  });

  it('keeps a valid focus mode and limit', () => {
    const s = toFormSettings({ mode: 'focus', limit: 25, collectIdentity: true });
    expect(s).toMatchObject({ mode: 'focus', limit: 25, collectIdentity: true });
  });

  it('rejects a bogus mode', () => {
    expect(toFormSettings({ mode: 'hologram' }).mode).toBe('page');
  });

  it('keeps a payment link only when it is https, and trims the label', () => {
    const ok = toFormSettings({ paymentUrl: ' https://buy.stripe.com/abc ', paymentLabel: '  Pay the deposit  ' });
    expect(ok.paymentUrl).toBe('https://buy.stripe.com/abc');
    expect(ok.paymentLabel).toBe('Pay the deposit');
    // http, javascript: and junk are dropped — a pay button never renders an unsafe href
    expect(toFormSettings({ paymentUrl: 'http://buy.stripe.com/abc' }).paymentUrl).toBeNull();
    expect(toFormSettings({ paymentUrl: 'javascript:alert(1)' }).paymentUrl).toBeNull();
    expect(toFormSettings({ paymentUrl: 'not a url' }).paymentUrl).toBeNull();
    expect(toFormSettings({}).paymentUrl).toBeNull();
  });
});

describe('validateAnswer', () => {
  it('only complains about empty when the field is required', () => {
    expect(validateAnswer(field({ required: true }), '')).toBe('This one is required.');
    expect(validateAnswer(field({ required: true }), '   ')).toBe('This one is required.');
    expect(validateAnswer(field(), '')).toBeNull();
  });

  it('checks email shape', () => {
    const email = field({ type: 'email' });
    expect(validateAnswer(email, 'dana@northstar.co')).toBeNull();
    expect(validateAnswer(email, 'not-an-email')).not.toBeNull();
    expect(validateAnswer(email, 'a@b')).not.toBeNull();
  });

  it('checks phone, number and rating ranges', () => {
    expect(validateAnswer(field({ type: 'phone' }), '+1 415 555 0134')).toBeNull();
    expect(validateAnswer(field({ type: 'phone' }), '12')).not.toBeNull();
    expect(validateAnswer(field({ type: 'number' }), '42')).toBeNull();
    expect(validateAnswer(field({ type: 'number' }), 'lots')).not.toBeNull();
    expect(validateAnswer(field({ type: 'rating' }), 5)).toBeNull();
    expect(validateAnswer(field({ type: 'rating' }), 9)).not.toBeNull();
  });

  it('treats an empty multi-select as no answer', () => {
    expect(validateAnswer(field({ type: 'multi_select', required: true }), [])).toBe('This one is required.');
    expect(validateAnswer(field({ type: 'multi_select', required: true }), ['a'])).toBeNull();
  });

  it('never validates layout blocks', () => {
    expect(validateAnswer({ id: 'h', type: 'heading', label: 'Section', required: true }, null)).toBeNull();
  });
});

describe('validateAll', () => {
  const blocks: FormBlock[] = [
    field({ id: 'name', required: true }),
    field({ id: 'mail', type: 'email', required: true }),
    { id: 'note', type: 'long_text', label: 'Notes' },
    { id: 'head', type: 'heading', label: 'Section' },
  ];

  it('reports one error per offending field, keyed by block id', () => {
    const errors = validateAll(blocks, { name: '', mail: 'bad' });
    expect(Object.keys(errors).sort()).toEqual(['mail', 'name']);
  });

  it('returns nothing when the submission is good', () => {
    expect(validateAll(blocks, { name: 'Dana', mail: 'dana@northstar.co' })).toEqual({});
  });
});

describe('conditional logic', () => {
  const blocks: FormBlock[] = [
    { id: 'kind', type: 'select', label: 'What kind of work?', options: ['Website', 'Brand'] },
    { id: 'pages', type: 'number', label: 'How many pages?', required: true, showWhen: { fieldId: 'kind', op: 'is', value: 'Website' } },
    { id: 'budget', type: 'number', label: 'Budget' },
    { id: 'call', type: 'yes_no', label: 'Book a call?', showWhen: { fieldId: 'budget', op: 'gt', value: '10000' } },
    { id: 'needs', type: 'multi_select', label: 'Needs', options: ['Design', 'Build'] },
    { id: 'devnote', type: 'long_text', label: 'Stack notes', showWhen: { fieldId: 'needs', op: 'is', value: 'Build' } },
  ];

  it('shows a conditional field only when its condition holds', () => {
    expect(visibleBlocks(blocks, { kind: 'Website' }).map((b) => b.id)).toContain('pages');
    expect(visibleBlocks(blocks, { kind: 'Brand' }).map((b) => b.id)).not.toContain('pages');
    expect(visibleBlocks(blocks, {}).map((b) => b.id)).not.toContain('pages');
  });

  it('compares numbers numerically, not as strings', () => {
    expect(isBlockVisible(blocks[3], blocks, { budget: '9000' })).toBe(false);
    expect(isBlockVisible(blocks[3], blocks, { budget: '25000' })).toBe(true);
    // '9' > '10000' as a string, but not as a number
    expect(isBlockVisible(blocks[3], blocks, { budget: '9' })).toBe(false);
  });

  it('matches a multi-select against any chosen option', () => {
    expect(isBlockVisible(blocks[5], blocks, { needs: ['Design'] })).toBe(false);
    expect(isBlockVisible(blocks[5], blocks, { needs: ['Design', 'Build'] })).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isBlockVisible(blocks[1], blocks, { kind: 'website' })).toBe(true);
  });

  it('handles answered / not_answered', () => {
    const b: FormBlock[] = [
      { id: 'a', type: 'short_text', label: 'A' },
      { id: 'b', type: 'short_text', label: 'B', showWhen: { fieldId: 'a', op: 'answered' } },
      { id: 'c', type: 'short_text', label: 'C', showWhen: { fieldId: 'a', op: 'not_answered' } },
    ];
    expect(visibleBlocks(b, { a: 'hi' }).map((x) => x.id)).toEqual(['a', 'b']);
    expect(visibleBlocks(b, { a: '' }).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('treats a condition on a deleted field as inert, not hidden', () => {
    const orphan: FormBlock[] = [{ id: 'x', type: 'short_text', label: 'X', showWhen: { fieldId: 'gone', op: 'is', value: 'y' } }];
    expect(visibleBlocks(orphan, {}).map((b) => b.id)).toEqual(['x']);
    expect(conditionSentence(orphan[0].showWhen!, orphan)).toBeNull();
  });

  it('never blocks submit on a required question the respondent never saw', () => {
    // `pages` is required but only shown for Website
    expect(validateAll(blocks, { kind: 'Brand' })).toEqual({});
    expect(validateAll(blocks, { kind: 'Website' })).toHaveProperty('pages');
  });

  it('round-trips conditions through the defensive parser and drops bad ops', () => {
    const parsed = toFormContent({
      blocks: [
        { id: 'a', type: 'short_text', label: 'A' },
        { id: 'b', type: 'short_text', label: 'B', showWhen: { fieldId: 'a', op: 'is', value: 'x' } },
        { id: 'c', type: 'short_text', label: 'C', showWhen: { fieldId: 'a', op: 'sorcery', value: 'x' } },
        { id: 'd', type: 'short_text', label: 'D', showWhen: 'nope' },
      ],
    });
    expect(parsed.blocks[1].showWhen).toEqual({ fieldId: 'a', op: 'is', value: 'x' });
    expect(parsed.blocks[2].showWhen).toBeUndefined();
    expect(parsed.blocks[3].showWhen).toBeUndefined();
  });

  it('writes a readable sentence for the logic summary', () => {
    expect(conditionSentence(blocks[1].showWhen!, blocks)).toBe('“What kind of work?” is “Website”');
    expect(conditionSentence({ fieldId: 'kind', op: 'answered' }, blocks)).toBe('“What kind of work?” is answered');
  });

  it('reports which fields survive pruning after a branch changes', () => {
    // answered `pages`, then switched to Brand — pages must fall out of scope
    const ids = visibleFieldIds(blocks, { kind: 'Brand', pages: '12' });
    expect(ids.has('pages')).toBe(false);
    expect(ids.has('budget')).toBe(true);
  });
});

describe('answerToText', () => {
  it('renders each answer shape as one display line', () => {
    expect(answerToText(field({ type: 'multi_select' }), ['Strategy', 'Design'])).toBe('Strategy, Design');
    expect(answerToText(field({ type: 'yes_no' }), 'Yes')).toBe('Yes');
    expect(answerToText(field({ type: 'yes_no' }), 'No')).toBe('No');
    expect(answerToText(field({ type: 'rating' }), 4)).toBe('4');
    expect(answerToText(field(), null)).toBe('');
  });

  it('shows a file answer as its original filename, not the storage path', () => {
    const file = field({ type: 'file' });
    // path = <formId>/<token>-<original name>; token carries no dash.
    expect(answerToText(file, 'a1b2c3/9f8e7d6c5b4a-brief.pdf')).toBe('brief.pdf');
    // a filename with its own dashes survives — only the first dash is the boundary
    expect(answerToText(file, 'a1b2c3/9f8e-final-scope-v2.docx')).toBe('final-scope-v2.docx');
    expect(answerToText(file, '')).toBe('');
  });
});

describe('file field', () => {
  it('is a field type and takes no options', () => {
    expect(isField('file')).toBe(true);
    expect(hasOptions('file')).toBe(false);
    expect(emptyBlock('file').options).toBeUndefined();
    expect(emptyBlock('file').required).toBe(false);
  });

  it('validates on presence only — a non-empty path is always accepted', () => {
    expect(validateAnswer(field({ type: 'file', required: true }), null)).toBe('This one is required.');
    expect(validateAnswer(field({ type: 'file', required: true }), 'form/tok-a.pdf')).toBeNull();
    expect(validateAnswer(field({ type: 'file' }), null)).toBeNull();
  });
});

describe('form templates', () => {
  it('keeps every template under the 10-question completion cliff', () => {
    for (const t of FORM_TEMPLATES) {
      const questions = t.blocks.filter((b) => isField(b.type));
      expect(questions.length, `${t.key} has ${questions.length} questions`).toBeLessThanOrEqual(10);
      expect(questions.length).toBeGreaterThan(0);
    }
  });

  it('has a unique key and non-empty copy for each', () => {
    const keys = FORM_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of FORM_TEMPLATES) {
      expect(t.name.trim()).not.toBe('');
      expect(t.title.trim()).not.toBe('');
      expect(t.blocks.every((b) => b.label.trim() !== '')).toBe(true);
    }
  });

  it('mints unique ids on instantiate', () => {
    for (const t of FORM_TEMPLATES) {
      const blocks = instantiate(t);
      const ids = blocks.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(blocks.length).toBe(t.blocks.length);
    }
  });

  it('resolves the "depends on the question above" marker to a real id', () => {
    for (const t of FORM_TEMPLATES) {
      const blocks = instantiate(t);
      blocks.forEach((b, i) => {
        if (!b.showWhen) return;
        // never left empty, and always points at a block that exists ABOVE it
        expect(b.showWhen.fieldId, `${t.key}/${b.label}`).not.toBe('');
        const sourceIndex = blocks.findIndex((x) => x.id === b.showWhen!.fieldId);
        expect(sourceIndex).toBeGreaterThanOrEqual(0);
        expect(sourceIndex).toBeLessThan(i);
      });
    }
  });

  it('produces templates whose logic actually resolves at fill time', () => {
    const feedback = instantiate(FORM_TEMPLATES.find((t) => t.key === 'feedback')!);
    const gate = feedback.find((b) => b.label.includes('factually wrong'))!;
    const dependent = feedback.find((b) => b.showWhen?.fieldId === gate.id)!;
    expect(isBlockVisible(dependent, feedback, { [gate.id]: 'No' })).toBe(false);
    expect(isBlockVisible(dependent, feedback, { [gate.id]: 'Yes' })).toBe(true);
  });

  it('looks templates up by key and ignores unknown ones', () => {
    expect(templateByKey('intake')?.name).toBe('Client intake');
    expect(templateByKey('nope')).toBeUndefined();
    expect(templateByKey(null)).toBeUndefined();
  });
});
