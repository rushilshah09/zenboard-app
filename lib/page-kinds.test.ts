import { describe, it, expect } from 'vitest';
import { isDocumentPage, CLAIMED_PAGE_TYPES } from './page-kinds';

describe('which module owns a page', () => {
  it('Documents owns its own kinds', () => {
    for (const t of ['note', 'doc', 'template', 'database', 'brief', 'review']) {
      expect(isDocumentPage(t)).toBe(true);
    }
  });

  // The bug this exists for: a content piece has no folder, and Documents'
  // default view is "pages with no folder" — so every video in the pipeline
  // showed up in Docs as a stray untitled document.
  it('Content owns its pieces, and Documents does not show them', () => {
    expect(isDocumentPage('content')).toBe(false);
    expect(CLAIMED_PAGE_TYPES.has('content')).toBe(true);
  });

  // Hiding someone's writing fails silently and permanently; showing an
  // unrecognised page costs one row.
  it('shows a page whose type nobody recognises', () => {
    for (const t of ['whatever', '', null, undefined]) expect(isDocumentPage(t)).toBe(true);
  });
});
