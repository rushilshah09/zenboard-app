import { describe, it, expect } from 'vitest';
import { numberSuffix, nextNumberFrom } from './invoice-number';

describe('numberSuffix', () => {
  it('reads the trailing digits of the numbering schemes people actually use', () => {
    expect(numberSuffix('INV-014')).toBe(14);
    expect(numberSuffix('2026-07')).toBe(7);
    expect(numberSuffix('7')).toBe(7);
    expect(numberSuffix('MERIDIAN/INV/0009')).toBe(9);
  });

  it('is null when there is nothing to read', () => {
    expect(numberSuffix('DRAFT')).toBeNull();
    expect(numberSuffix('')).toBeNull();
  });
});

describe('nextNumberFrom', () => {
  it('starts at INV-001', () => {
    expect(nextNumberFrom([])).toBe('INV-001');
  });

  it('continues from the highest in use', () => {
    expect(nextNumberFrom(['INV-001', 'INV-002', 'INV-003'])).toBe('INV-004');
  });

  // The reason this is max-based and not count-based. Counting hands out a
  // number that is already on a piece of paper someone has.
  it('does NOT reuse a number after one is deleted or voided', () => {
    expect(nextNumberFrom(['INV-001', 'INV-003', 'INV-004'])).toBe('INV-005');
  });

  it('is unaffected by the order rows come back in', () => {
    expect(nextNumberFrom(['INV-009', 'INV-002', 'INV-011', 'INV-004'])).toBe('INV-012');
  });

  it('ignores entries it cannot read rather than restarting at 1', () => {
    expect(nextNumberFrom(['INV-007', 'DEPOSIT', ''])).toBe('INV-008');
  });

  it('keeps padding once the count outgrows it', () => {
    expect(nextNumberFrom(['INV-999'])).toBe('INV-1000');
  });
});
