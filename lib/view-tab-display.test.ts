import { describe, it, expect } from 'vitest';
import { parseTabDisplays } from './view-tab-display';

describe('parseTabDisplays — a preference read back from this device', () => {
  it('keeps the displays it knows', () => {
    expect(parseTabDisplays('{"a":"icon","b":"text"}')).toEqual({ a: 'icon', b: 'text' });
  });
  it('drops a display this build does not know, and anything that is not a map', () => {
    expect(parseTabDisplays('{"a":"huge","b":"text"}')).toEqual({ b: 'text' });
    expect(parseTabDisplays('["icon"]')).toEqual({});
    expect(parseTabDisplays('not json')).toEqual({});
    expect(parseTabDisplays(null)).toEqual({});
  });
});
