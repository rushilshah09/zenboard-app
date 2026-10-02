import { describe, it, expect } from 'vitest';
import { readPins, writePins, addPin, removePin, togglePin, movePin, isPinned, MAX_PINS, type Pin } from './pins';

const TYPES = ['task', 'project', 'client', 'doc', 'invoice', 'goal', 'meeting',
  'request', 'feedback', 'form', 'content', 'event', 'memory'] as const;

const pin = (type: string, id: string, label = 'X') => ({ type, id, label }) as Pin;

describe('readPins', () => {
  it('reads what was written', () => {
    const pins = [pin('project', 'p1', 'Ridgeline'), pin('doc', 'd1', 'Brief')];
    expect(readPins(writePins(pins), TYPES)).toEqual(pins);
  });

  it('survives a preferences object that has never held pins', () => {
    // The column already carries accent/density for existing users.
    expect(readPins({ accent: 'blue', density: 'compact' }, TYPES)).toEqual([]);
    expect(readPins(null, TYPES)).toEqual([]);
    expect(readPins(undefined, TYPES)).toEqual([]);
    expect(readPins({ pins: 'nonsense' }, TYPES)).toEqual([]);
  });

  it('drops entries it cannot navigate to', () => {
    // The reader decides what is valid, because the column is free-form: an
    // unknown type has no `recordHref`, so a row for it would be dead chrome.
    const raw = { pins: [
      pin('project', 'p1'),
      { type: 'spaceship', id: 'x', label: 'No' },
      { type: 'doc' },                    // no id
      { type: 'doc', id: '' },            // empty id
      null,
      'string',
    ] };
    expect(readPins(raw, TYPES).map((p) => p.id)).toEqual(['p1']);
  });

  it('collapses a record pinned twice into one row', () => {
    const raw = { pins: [pin('doc', 'd1', 'First'), pin('doc', 'd1', 'Second')] };
    const out = readPins(raw, TYPES);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('First');   // the earlier one wins; order is the user's
  });

  it('names a pin that lost its label rather than rendering blank', () => {
    expect(readPins({ pins: [{ type: 'doc', id: 'd1' }] }, TYPES)[0].label).toBe('Untitled');
    expect(readPins({ pins: [{ type: 'doc', id: 'd1', label: '   ' }] }, TYPES)[0].label).toBe('Untitled');
  });
});

describe('editing', () => {
  it('pinning something already pinned changes nothing', () => {
    const pins = [pin('project', 'p1')];
    expect(addPin(pins, pin('project', 'p1', 'Renamed'))).toBe(pins);
  });

  it('tells two types with the same id apart', () => {
    // Ids are only unique within a table, so `doc:1` and `task:1` are different
    // records and both may be pinned.
    let pins = addPin([], pin('doc', '1'));
    pins = addPin(pins, pin('task', '1'));
    expect(pins).toHaveLength(2);
    expect(isPinned(pins, { type: 'task', id: '1' } as Pin)).toBe(true);
    pins = removePin(pins, { type: 'task', id: '1' } as Pin);
    expect(pins.map((p) => p.type)).toEqual(['doc']);
  });

  it('toggles', () => {
    const p = pin('form', 'f1');
    expect(togglePin([], p)).toHaveLength(1);
    expect(togglePin([p], p)).toHaveLength(0);
  });
});

describe('movePin', () => {
  const list = [pin('doc', 'a'), pin('doc', 'b'), pin('doc', 'c')];
  const ids = (p: Pin[]) => p.map((x) => x.id);

  it('moves down and up', () => {
    expect(ids(movePin(list, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(ids(movePin(list, 2, 0))).toEqual(['c', 'a', 'b']);
  });

  it('leaves the list alone for a cancelled drag', () => {
    // A drag that ends outside the list is normal, not an error.
    expect(movePin(list, 1, 1)).toBe(list);
    expect(movePin(list, -1, 0)).toBe(list);
    expect(movePin(list, 0, 9)).toBe(list);
  });
});

describe('the ceiling', () => {
  it('holds far more than anyone pins, and stops there', () => {
    const many = Array.from({ length: MAX_PINS + 10 }, (_, i) => pin('doc', `d${i}`));
    expect(writePins(many).pins).toHaveLength(MAX_PINS);
    expect(readPins({ pins: many }, TYPES)).toHaveLength(MAX_PINS);
    expect(addPin(many.slice(0, MAX_PINS), pin('doc', 'extra'))).toHaveLength(MAX_PINS);
  });
});
