import { describe, it, expect } from 'vitest';
import {
  readStageLabels, writeStageLabels, stageName, normalizeStageName, withStageName,
  STAGE_NAME_MAX, type StageLabels,
} from './stage-labels';
import { STAGE_LABEL } from './content';

describe('reading renamed stages', () => {
  it('is empty when nobody renamed anything', () => {
    for (const nothing of [undefined, null, {}, 'nope', [], { contentStageLabels: 7 }]) {
      expect(readStageLabels(nothing)).toEqual({});
    }
  });

  it('reads a rename back', () => {
    expect(readStageLabels({ contentStageLabels: { edit: 'The cut' } })).toEqual({ edit: 'The cut' });
  });

  // A JSON column has no database to reject a bad key, so the READER is the
  // only guard — the lesson lib/properties.ts and readContent both learned. A
  // label under a stage that does not exist would reach a column header.
  it('drops keys that are not stages, and values that are not names', () => {
    expect(readStageLabels({
      contentStageLabels: { edit: 'The cut', filming: 'Nope', DONE: 'x', review: 42, shoot: null },
    })).toEqual({ edit: 'The cut' });
  });

  it('treats a stored blank as no override, not a nameless column', () => {
    expect(readStageLabels({ contentStageLabels: { edit: '   ' } })).toEqual({});
  });

  // Storing a copy of the default would quietly opt that person out of any later
  // change to the default.
  it('drops a label that is just the default again', () => {
    expect(readStageLabels({ contentStageLabels: { edit: STAGE_LABEL.edit } })).toEqual({});
  });

  it('caps a name that would break the column header', () => {
    const long = 'x'.repeat(200);
    expect(readStageLabels({ contentStageLabels: { edit: long } }).edit).toHaveLength(STAGE_NAME_MAX);
  });

  it('round-trips through write', () => {
    const labels: StageLabels = { idea: 'Sparks', published: 'Out' };
    expect(readStageLabels(writeStageLabels(labels))).toEqual(labels);
  });
});

describe('what a stage is called', () => {
  it('falls back to the default', () => {
    expect(stageName({}, 'edit')).toBe(STAGE_LABEL.edit);
  });
  it('prefers the rename', () => {
    expect(stageName({ edit: 'The cut' }, 'edit')).toBe('The cut');
  });
});

describe('typing a new name', () => {
  it('keeps a real name, tidied', () => {
    expect(normalizeStageName('  The   cut  ', 'edit')).toBe('The cut');
  });

  // Clearing the field and asking for the default back are one intention, which
  // is why there is no separate reset control.
  it('reads an emptied field as "put the default back"', () => {
    for (const blank of ['', '   ', '\t']) expect(normalizeStageName(blank, 'edit')).toBeNull();
  });

  it('reads the default typed back in as no override', () => {
    expect(normalizeStageName(STAGE_LABEL.edit, 'edit')).toBeNull();
  });

  it('caps the length', () => {
    expect(normalizeStageName('y'.repeat(100), 'edit')).toHaveLength(STAGE_NAME_MAX);
  });
});

describe('applying a rename', () => {
  it('sets one without touching the others', () => {
    expect(withStageName({ idea: 'Sparks' }, 'edit', 'The cut')).toEqual({ idea: 'Sparks', edit: 'The cut' });
  });

  it('removes the override when the name is null', () => {
    expect(withStageName({ idea: 'Sparks', edit: 'The cut' }, 'edit', null)).toEqual({ idea: 'Sparks' });
  });

  it('does not mutate what it was given', () => {
    const before: StageLabels = { idea: 'Sparks' };
    withStageName(before, 'edit', 'The cut');
    expect(before).toEqual({ idea: 'Sparks' });
  });
});
